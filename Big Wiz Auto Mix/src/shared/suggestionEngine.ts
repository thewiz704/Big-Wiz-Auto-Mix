import { 
  ProcessingSuggestion, 
  ModuleType, 
  EQBand, 
  ProcessingModule,
  SpectrumAnalysis,
  LUFSMetering 
} from './processingChain';
import { StemRole } from './types';

export class SuggestionEngine {
  private audioContext: AudioContext;
  private genreProfile: GenreProfile | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async analyzeAndSuggest(
    stems: { id: string; role: StemRole; buffer: AudioBuffer }[],
    mixSpectrum: SpectrumAnalysis,
    lufsMetering: LUFSMetering,
    targetGenre?: string
  ): Promise<ProcessingSuggestion[]> {
    const suggestions: ProcessingSuggestion[] = [];

    // Set genre profile for context-aware suggestions
    if (targetGenre) {
      this.genreProfile = this.getGenreProfile(targetGenre);
    }

    // Analyze each stem individually
    for (const stem of stems) {
      const stemSuggestions = await this.analyzeStem(stem, mixSpectrum);
      suggestions.push(...stemSuggestions);
    }

    // Analyze overall mix
    const mixSuggestions = this.analyzeMix(mixSpectrum, lufsMetering);
    suggestions.push(...mixSuggestions);

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeStem(
    stem: { id: string; role: StemRole; buffer: AudioBuffer },
    mixSpectrum: SpectrumAnalysis
  ): Promise<ProcessingSuggestion[]> {
    const suggestions: ProcessingSuggestion[] = [];
    const spectrum = await this.extractStemSpectrum(stem.buffer);

    // Role-specific analysis
    switch (stem.role) {
      case StemRole.KICK:
        suggestions.push(...this.analyzeKick(spectrum, stem.id));
        break;
      case StemRole.SNARE:
        suggestions.push(...this.analyzeSnare(spectrum, stem.id));
        break;
      case StemRole.BASS:
        suggestions.push(...this.analyzeBass(spectrum, stem.id));
        break;
      case StemRole.VOCAL:
      case StemRole.LEAD:
        suggestions.push(...this.analyzeVocal(spectrum, stem.id));
        break;
      case StemRole.DRUMS:
        suggestions.push(...this.analyzeDrums(spectrum, stem.id));
        break;
      default:
        suggestions.push(...this.analyzeGeneric(spectrum, stem.id, stem.role));
    }

    // Check for masking issues
    const maskingSuggestions = this.analyzeMasking(stem, mixSpectrum);
    suggestions.push(...maskingSuggestions);

    return suggestions;
  }

  private analyzeSnare(spectrum: number[], stemId: string): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];
    
    const snapEnergy = this.getEnergyInRange(spectrum, 200, 300);
    const crackEnergy = this.getEnergyInRange(spectrum, 2000, 8000);
    
    if (snapEnergy < 0.4) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.7,
        description: "Add snare body and snap",
        parameters: {
          [`${stemId}_body_gain`]: 2,
          [`${stemId}_body_freq`]: 250,
          [`${stemId}_body_q`]: 1.5
        },
        reasoning: "Low body energy. Adding 250Hz will improve snare fullness."
      });
    }
    
    if (crackEnergy < 0.3) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.8,
        description: "Enhance snare crack",
        parameters: {
          [`${stemId}_crack_gain`]: 3,
          [`${stemId}_crack_freq`]: 5000,
          [`${stemId}_crack_q`]: 2.0
        },
        reasoning: "Adding high-frequency crack will improve snare definition."
      });
    }
    
    return suggestions;
  }

  private analyzeKick(spectrum: number[], stemId: string): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];
    
    // Check for sub-bass content
    const subBassEnergy = this.getEnergyInRange(spectrum, 20, 60);
    const lowMidEnergy = this.getEnergyInRange(spectrum, 200, 500);
    const clickEnergy = this.getEnergyInRange(spectrum, 2000, 8000);

    if (subBassEnergy < 0.3) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.8,
        description: "Boost sub-bass for kick weight",
        parameters: {
          [`${stemId}_low_gain`]: 3,
          [`${stemId}_low_freq`]: 50,
          [`${stemId}_low_q`]: 1.2
        },
        reasoning: "Low sub-bass energy detected. Adding sub-bass boost will improve kick impact and weight."
      });
    }

    if (lowMidEnergy > 0.7) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.7,
        description: "Reduce muddy low-mids",
        parameters: {
          [`${stemId}_lowmid_gain`]: -2,
          [`${stemId}_lowmid_freq`]: 300,
          [`${stemId}_lowmid_q`]: 2.0
        },
        reasoning: "Excessive low-mid energy can cause muddiness. Gentle cut will improve clarity."
      });
    }

    if (clickEnergy < 0.2) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.6,
        description: "Add click for kick definition",
        parameters: {
          [`${stemId}_click_gain`]: 2,
          [`${stemId}_click_freq`]: 4000,
          [`${stemId}_click_q`]: 1.5
        },
        reasoning: "Low click energy. Adding presence will improve kick definition in the mix."
      });
    }

    // Suggest compression for punch
    suggestions.push({
      moduleType: ModuleType.COMPRESSOR,
      confidence: 0.75,
      description: "Enhance kick punch",
      parameters: {
        threshold: -15,
        ratio: 4,
        attack: 1,
        release: 100,
        makeupGain: 3
      },
      reasoning: "Fast compression will enhance transient punch and control dynamics."
    });

    return suggestions;
  }

  private analyzeBass(spectrum: number[], stemId: string): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];
    
    const subEnergy = this.getEnergyInRange(spectrum, 20, 80);
    const fundamentalEnergy = this.getEnergyInRange(spectrum, 80, 200);
    const harmonicEnergy = this.getEnergyInRange(spectrum, 200, 800);

    // HPF suggestion if too much sub content
    if (subEnergy > 0.4) {
      suggestions.push({
        moduleType: ModuleType.HPF,
        confidence: 0.8,
        description: "Clean up sub-sonic rumble",
        parameters: {
          frequency: 40,
          slope: 12
        },
        reasoning: "Excessive sub-sonic content can muddy the mix. High-pass filtering will clean up the low end."
      });
    }

    // Fundamental frequency enhancement
    suggestions.push({
      moduleType: ModuleType.EQ,
      confidence: 0.7,
      description: "Enhance bass fundamental",
      parameters: {
        [`${stemId}_fundamental_gain`]: 2,
        [`${stemId}_fundamental_freq`]: this.detectFundamental(spectrum, 80, 200),
        [`${stemId}_fundamental_q`]: 1.0
      },
      reasoning: "Boosting the fundamental frequency will improve bass presence and power."
    });

    // Check for harmonic content
    if (harmonicEnergy < 0.3) {
      suggestions.push({
        moduleType: ModuleType.SATURATOR,
        confidence: 0.6,
        description: "Add harmonic richness",
        parameters: {
          drive: 3,
          character: 'warm',
          mix: 25
        },
        reasoning: "Low harmonic content. Gentle saturation will add richness and help bass cut through."
      });
    }

    return suggestions;
  }

  private analyzeVocal(spectrum: number[], stemId: string): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];
    
    const presenceEnergy = this.getEnergyInRange(spectrum, 2000, 5000);
    const airEnergy = this.getEnergyInRange(spectrum, 8000, 20000);
    const bodyEnergy = this.getEnergyInRange(spectrum, 200, 800);

    // Presence boost for clarity
    if (presenceEnergy < 0.4) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.8,
        description: "Boost vocal presence",
        parameters: {
          [`${stemId}_presence_gain`]: 3,
          [`${stemId}_presence_freq`]: 3000,
          [`${stemId}_presence_q`]: 1.2
        },
        reasoning: "Low presence energy. Boosting 3kHz will improve vocal clarity and intelligibility."
      });
    }

    // Air frequencies for sparkle
    if (airEnergy < 0.2) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.6,
        description: "Add vocal air and sparkle",
        parameters: {
          [`${stemId}_air_gain`]: 2,
          [`${stemId}_air_freq`]: 12000,
          [`${stemId}_air_q`]: 0.7
        },
        reasoning: "Adding high-frequency sparkle will improve vocal brightness and perceived quality."
      });
    }

    // Dynamic EQ for sibilance control
    const sibilanceEnergy = this.getEnergyInRange(spectrum, 6000, 10000);
    if (sibilanceEnergy > 0.6) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.9,
        description: "Control sibilance dynamically",
        parameters: {
          [`${stemId}_desser_gain`]: -3,
          [`${stemId}_desser_freq`]: 7000,
          [`${stemId}_desser_q`]: 2.0,
          [`${stemId}_desser_dynamic`]: true,
          [`${stemId}_desser_threshold`]: -20
        },
        reasoning: "High sibilance energy detected. Dynamic EQ will control harsh frequencies only when needed."
      });
    }

    // Compression for consistency
    suggestions.push({
      moduleType: ModuleType.COMPRESSOR,
      confidence: 0.75,
      description: "Smooth vocal dynamics",
      parameters: {
        threshold: -12,
        ratio: 3,
        attack: 5,
        release: 80,
        makeupGain: 3
      },
      reasoning: "Gentle compression will smooth out dynamic variations and improve vocal consistency."
    });

    return suggestions;
  }

  private analyzeDrums(spectrum: number[], stemId: string): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];
    
    const kickEnergy = this.getEnergyInRange(spectrum, 60, 120);
    const snareEnergy = this.getEnergyInRange(spectrum, 200, 300);
    const cymbalsEnergy = this.getEnergyInRange(spectrum, 8000, 20000);

    // Overall drum processing
    if (cymbalsEnergy > 0.7) {
      suggestions.push({
        moduleType: ModuleType.EQ,
        confidence: 0.7,
        description: "Tame harsh cymbals",
        parameters: {
          [`${stemId}_cymbals_gain`]: -2,
          [`${stemId}_cymbals_freq`]: 10000,
          [`${stemId}_cymbals_q`]: 1.5
        },
        reasoning: "High cymbal energy can be harsh. Gentle high-frequency cut will smooth the drum sound."
      });
    }

    // Transient enhancement
    suggestions.push({
      moduleType: ModuleType.TRANSIENT_SHAPER,
      confidence: 0.8,
      description: "Enhance drum transients",
      parameters: {
        attack: 25,
        sustain: -10,
        frequency: 1000
      },
      reasoning: "Enhancing transients will improve drum punch and definition."
    });

    return suggestions;
  }

  private analyzeGeneric(spectrum: number[], stemId: string, role: StemRole): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];
    
    // Detect if HPF is needed
    const subEnergy = this.getEnergyInRange(spectrum, 20, 60);
    if (subEnergy > 0.3 && role !== StemRole.BASS && role !== StemRole.KICK) {
      suggestions.push({
        moduleType: ModuleType.HPF,
        confidence: 0.6,
        description: "Remove unnecessary low frequencies",
        parameters: {
          frequency: 80,
          slope: 12
        },
        reasoning: "High sub-bass content in non-bass instrument. HPF will clean up the mix."
      });
    }

    return suggestions;
  }

  private analyzeMix(
    mixSpectrum: SpectrumAnalysis,
    lufsMetering: LUFSMetering
  ): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];

    // LUFS analysis
    if (lufsMetering.integrated < -23) {
      suggestions.push({
        moduleType: ModuleType.LIMITER,
        confidence: 0.8,
        description: "Increase overall loudness",
        parameters: {
          ceiling: -0.1,
          release: 50
        },
        reasoning: `Mix is at ${lufsMetering.integrated.toFixed(1)} LUFS. Limiting will increase perceived loudness.`
      });
    }

    // Spectral balance analysis
    const lowEnergy = this.getEnergyInRange(mixSpectrum.magnitudes, 0, 200);
    const midEnergy = this.getEnergyInRange(mixSpectrum.magnitudes, 200, 2000);
    const highEnergy = this.getEnergyInRange(mixSpectrum.magnitudes, 2000, 20000);

    const total = lowEnergy + midEnergy + highEnergy;
    const lowRatio = lowEnergy / total;
    const midRatio = midEnergy / total;
    const highRatio = highEnergy / total;

    // Check spectral balance against genre profile
    if (this.genreProfile) {
      const balance = this.genreProfile.spectralBalance;
      
      if (lowRatio < balance.low - 0.1) {
        suggestions.push({
          moduleType: ModuleType.EQ,
          confidence: 0.7,
          description: "Increase low-end warmth",
          parameters: {
            mix_low_gain: 2,
            mix_low_freq: 100,
            mix_low_q: 0.7
          },
          reasoning: `Low energy (${(lowRatio * 100).toFixed(1)}%) is below ${this.genreProfile.name} profile. Adding warmth will improve balance.`
        });
      }

      if (highRatio < balance.high - 0.1) {
        suggestions.push({
          moduleType: ModuleType.EQ,
          confidence: 0.7,
          description: "Add high-frequency sparkle",
          parameters: {
            mix_high_gain: 1.5,
            mix_high_freq: 10000,
            mix_high_q: 0.7
          },
          reasoning: `High energy (${(highRatio * 100).toFixed(1)}%) is below ${this.genreProfile.name} profile. Adding sparkle will improve presence.`
        });
      }
    }

    // Stereo width analysis
    if (mixSpectrum.maskingData) {
      const conflictLevel = mixSpectrum.maskingData.conflictLevel;
      if (conflictLevel === 'high') {
        suggestions.push({
          moduleType: ModuleType.STEREO_WIDTH,
          confidence: 0.8,
          description: "Improve stereo separation",
          parameters: {
            width: 120,
            bassMonoFreq: 120,
            bassMonoEnabled: true
          },
          reasoning: "High masking conflicts detected. Increasing stereo width will improve separation."
        });
      }
    }

    return suggestions;
  }

  private analyzeMasking(
    stem: { id: string; role: StemRole; buffer: AudioBuffer },
    mixSpectrum: SpectrumAnalysis
  ): ProcessingSuggestion[] {
    const suggestions: ProcessingSuggestion[] = [];

    if (!mixSpectrum.maskingData) return suggestions;

    const stemIndex = mixSpectrum.maskingData.stems.findIndex(s => s === stem.id);
    if (stemIndex === -1) return suggestions;

    // Find frequency ranges with high masking
    mixSpectrum.maskingData.frequencies.forEach((freq, freqIndex) => {
      const maskingLevel = mixSpectrum.maskingData!.maskingMatrix[stemIndex][freqIndex];
      
      if (maskingLevel > 0.7) {
        suggestions.push({
          moduleType: ModuleType.EQ,
          confidence: 0.8,
          description: `Reduce masking at ${freq}Hz`,
          parameters: {
            [`${stem.id}_mask_${freq}_gain`]: -1.5,
            [`${stem.id}_mask_${freq}_freq`]: freq,
            [`${stem.id}_mask_${freq}_q`]: 2.0
          },
          reasoning: `High masking detected at ${freq}Hz. Gentle cut will improve clarity.`
        });
      }
    });

    return suggestions;
  }

  private getEnergyInRange(spectrum: number[], minFreq: number, maxFreq: number): number {
    // Convert frequencies to spectrum indices (simplified)
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (spectrum.length * 2);
    
    const minBin = Math.floor(minFreq / binSize);
    const maxBin = Math.ceil(maxFreq / binSize);
    
    let energy = 0;
    let count = 0;
    
    for (let i = minBin; i <= maxBin && i < spectrum.length; i++) {
      energy += spectrum[i] * spectrum[i];
      count++;
    }
    
    return count > 0 ? Math.sqrt(energy / count) : 0;
  }

  private detectFundamental(spectrum: number[], minFreq: number, maxFreq: number): number {
    // Find peak frequency in range (simplified)
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (spectrum.length * 2);
    
    const minBin = Math.floor(minFreq / binSize);
    const maxBin = Math.ceil(maxFreq / binSize);
    
    let peakBin = minBin;
    let peakValue = 0;
    
    for (let i = minBin; i <= maxBin && i < spectrum.length; i++) {
      if (spectrum[i] > peakValue) {
        peakValue = spectrum[i];
        peakBin = i;
      }
    }
    
    return peakBin * binSize;
  }

  private async extractStemSpectrum(buffer: AudioBuffer): Promise<number[]> {
    // Create analyzer for stem
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 2048;
    
    // This would need actual audio processing to extract spectrum
    // For now, return a mock spectrum
    const spectrum = new Array(analyzer.frequencyBinCount).fill(0);
    
    // Mock some frequency content based on analysis
    for (let i = 0; i < spectrum.length; i++) {
      spectrum[i] = Math.random() * 0.5 + 0.1; // Random spectrum
    }
    
    return spectrum;
  }

  private getGenreProfile(genre: string): GenreProfile {
    const profiles: Record<string, GenreProfile> = {
      'pop': {
        name: 'Pop',
        spectralBalance: { low: 0.3, mid: 0.4, high: 0.3 },
        lufsTarget: -14,
        characteristics: ['bright', 'punchy', 'wide']
      },
      'rock': {
        name: 'Rock',
        spectralBalance: { low: 0.25, mid: 0.5, high: 0.25 },
        lufsTarget: -11,
        characteristics: ['aggressive', 'midrange-heavy', 'dynamic']
      },
      'hip-hop': {
        name: 'Hip-Hop',
        spectralBalance: { low: 0.4, mid: 0.35, high: 0.25 },
        lufsTarget: -12,
        characteristics: ['bass-heavy', 'punchy', 'loud']
      },
      'jazz': {
        name: 'Jazz',
        spectralBalance: { low: 0.3, mid: 0.4, high: 0.3 },
        lufsTarget: -18,
        characteristics: ['warm', 'dynamic', 'natural']
      },
      'electronic': {
        name: 'Electronic',
        spectralBalance: { low: 0.35, mid: 0.3, high: 0.35 },
        lufsTarget: -10,
        characteristics: ['bright', 'sub-heavy', 'wide', 'loud']
      }
    };

    return profiles[genre.toLowerCase()] || profiles['pop'];
  }
}

interface GenreProfile {
  name: string;
  spectralBalance: {
    low: number;
    mid: number; 
    high: number;
  };
  lufsTarget: number;
  characteristics: string[];
}

export default SuggestionEngine;