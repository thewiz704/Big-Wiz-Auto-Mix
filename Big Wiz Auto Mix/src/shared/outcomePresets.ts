import { PresetOutcome, ProcessingChain, ModuleType } from './processingChain';

export class OutcomePresetsManager {
  private presets: PresetOutcome[] = [];
  private readonly STORAGE_KEY = 'outcome_presets';

  constructor() {
    this.loadPresets();
    this.initializeFactoryPresets();
  }

  // Save preset based on outcome/goal rather than technical parameters
  saveOutcomePreset(
    name: string,
    description: string,
    chain: ProcessingChain,
    macroValues: PresetOutcome['macroValues'],
    options: {
      genre?: string[];
      stemTypes?: string[];
      mixingStage?: 'rough' | 'polish' | 'master';
      targetLUFS?: number;
      tags?: string[];
    } = {}
  ): PresetOutcome {
    const preset: PresetOutcome = {
      name,
      description,
      tags: options.tags || this.generateAutoTags(macroValues, chain),
      macroValues,
      moduleStates: this.extractModuleStates(chain),
      targetLUFS: options.targetLUFS || -14,
      usage: {
        genre: options.genre || ['pop'],
        stemTypes: options.stemTypes || ['all'],
        mixingStage: options.mixingStage || 'polish'
      }
    };

    // Remove existing preset with same name
    this.presets = this.presets.filter(p => p.name !== name);
    
    // Add new preset
    this.presets.push(preset);
    
    // Save to storage
    this.savePresets();
    
    return preset;
  }

  // Find presets based on desired outcome
  findPresetsByOutcome(criteria: {
    style?: 'punchy' | 'warm' | 'bright' | 'wide' | 'clean' | 'aggressive';
    genre?: string;
    mood?: 'energetic' | 'mellow' | 'dramatic' | 'intimate';
    loudness?: 'quiet' | 'moderate' | 'loud' | 'maximum';
    clarity?: 'smooth' | 'detailed' | 'crisp';
    width?: 'narrow' | 'natural' | 'wide';
  }): PresetOutcome[] {
    return this.presets.filter(preset => {
      // Style matching
      if (criteria.style) {
        const styleMatch = this.doesPresetMatchStyle(preset, criteria.style);
        if (!styleMatch) return false;
      }

      // Genre matching
      if (criteria.genre) {
        const genreMatch = preset.usage.genre.some(g => 
          g.toLowerCase().includes(criteria.genre!.toLowerCase())
        );
        if (!genreMatch) return false;
      }

      // Mood matching through macro values
      if (criteria.mood) {
        const moodMatch = this.doesPresetMatchMood(preset, criteria.mood);
        if (!moodMatch) return false;
      }

      // Loudness matching
      if (criteria.loudness) {
        const loudnessMatch = this.doesPresetMatchLoudness(preset, criteria.loudness);
        if (!loudnessMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by relevance score
      const scoreA = this.calculateRelevanceScore(a, criteria);
      const scoreB = this.calculateRelevanceScore(b, criteria);
      return scoreB - scoreA;
    });
  }

  // Get preset suggestions based on current mix analysis
  suggestPresets(
    currentMacros: PresetOutcome['macroValues'],
    analysisData: {
      lufs: number;
      genre?: string;
      dominantFrequencyRange: 'bass' | 'mid' | 'high';
      dynamicRange: 'low' | 'medium' | 'high';
      stereoWidth: number;
    }
  ): PresetOutcome[] {
    const suggestions: Array<{ preset: PresetOutcome; score: number; reason: string }> = [];

    this.presets.forEach(preset => {
      let score = 0;
      const reasons: string[] = [];

      // Loudness compatibility
      const lufsDistance = Math.abs(preset.targetLUFS - analysisData.lufs);
      if (lufsDistance < 3) {
        score += 20;
        reasons.push(`LUFS target (${preset.targetLUFS}) matches current level`);
      }

      // Genre compatibility
      if (analysisData.genre && preset.usage.genre.includes(analysisData.genre)) {
        score += 25;
        reasons.push(`Optimized for ${analysisData.genre} genre`);
      }

      // Macro value similarity (find presets that enhance current direction)
      Object.entries(currentMacros).forEach(([key, value]) => {
        const presetValue = preset.macroValues[key as keyof typeof preset.macroValues];
        const enhancement = presetValue - value;
        
        if (enhancement > 0 && enhancement <= 30) {
          score += 10;
          reasons.push(`Enhances ${key} (+${enhancement.toFixed(1)})`);
        }
      });

      // Dynamic range matching
      if (analysisData.dynamicRange === 'low' && preset.macroValues.punch > 70) {
        score += 15;
        reasons.push('Adds punch to compressed material');
      }

      // Stereo width matching
      const widthDiff = Math.abs(preset.macroValues.width - analysisData.stereoWidth);
      if (widthDiff < 20) {
        score += 10;
        reasons.push('Complementary stereo width');
      }

      if (score > 20) { // Minimum threshold
        suggestions.push({
          preset,
          score,
          reason: reasons.join(', ')
        });
      }
    });

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Top 5 suggestions
      .map(s => s.preset);
  }

  // Create smart preset from current state
  createSmartPreset(
    chain: ProcessingChain,
    analysisData: {
      lufs: number;
      spectrum: number[];
      genre?: string;
    }
  ): Partial<PresetOutcome> {
    const macroValues = this.extractMacroValues(chain, analysisData);
    const autoName = this.generatePresetName(macroValues, analysisData);
    const tags = this.generateAutoTags(macroValues, chain);

    return {
      name: autoName,
      description: this.generateDescription(macroValues, analysisData),
      macroValues,
      tags,
      targetLUFS: analysisData.lufs,
      usage: {
        genre: analysisData.genre ? [analysisData.genre] : ['versatile'],
        stemTypes: ['all'],
        mixingStage: this.detectMixingStage(analysisData.lufs, macroValues)
      }
    };
  }

  private extractModuleStates(chain: ProcessingChain): PresetOutcome['moduleStates'] {
    const states = {} as PresetOutcome['moduleStates'];
    
    chain.modules.forEach(module => {
      const moduleType = module.id as ModuleType;
      if (moduleType in ModuleType) {
        states[moduleType] = module.enabled;
      }
    });

    return states;
  }

  private extractMacroValues(
    chain: ProcessingChain, 
    analysisData: { spectrum: number[]; lufs: number }
  ): PresetOutcome['macroValues'] {
    // Analyze processing chain to extract macro values
    const compressor = chain.modules.find(m => m.id === 'compressor');
    const eq = chain.modules.find(m => m.id === 'eq');
    const saturator = chain.modules.find(m => m.id === 'saturator');
    const stereoWidth = chain.modules.find(m => m.id === 'stereo_width');

    return {
      punch: this.calculatePunchValue(compressor, analysisData),
      warmth: this.calculateWarmthValue(saturator, eq),
      clarity: this.calculateClarityValue(eq, analysisData.spectrum),
      air: this.calculateAirValue(eq, analysisData.spectrum),
      width: this.calculateWidthValue(stereoWidth, analysisData.spectrum)
    };
  }

  private calculatePunchValue(compressor: any, analysisData: any): number {
    if (!compressor?.enabled) return 0;
    
    const ratio = compressor.parameters.ratio || 1;
    const attack = compressor.parameters.attack || 100;
    const threshold = compressor.parameters.threshold || 0;
    
    // Fast attack + high ratio = more punch
    const punchFactor = (ratio / 10) * (100 - attack) / 100 * Math.abs(threshold) / 20;
    return Math.min(100, punchFactor * 100);
  }

  private calculateWarmthValue(saturator: any, eq: any): number {
    let warmth = 0;
    
    // Saturation contributes to warmth
    if (saturator?.enabled) {
      const drive = saturator.parameters.drive || 0;
      const character = saturator.parameters.character || 'warm';
      const characterMultiplier = character === 'warm' ? 1.5 : character === 'tube' ? 1.2 : 0.8;
      warmth += (drive / 10) * characterMultiplier * 30;
    }

    // Low-mid EQ boost contributes to warmth
    if (eq?.enabled && eq.bands) {
      eq.bands.forEach((band: any) => {
        if (band.enabled && band.frequency >= 100 && band.frequency <= 500 && band.gain > 0) {
          warmth += band.gain * 5;
        }
      });
    }

    return Math.min(100, warmth);
  }

  private calculateClarityValue(eq: any, spectrum: number[]): number {
    if (!eq?.enabled) return 50; // Neutral
    
    let clarity = 50;
    
    if (eq.bands) {
      eq.bands.forEach((band: any) => {
        if (band.enabled) {
          // Presence range boosts increase clarity
          if (band.frequency >= 2000 && band.frequency <= 5000 && band.gain > 0) {
            clarity += band.gain * 8;
          }
          // Muddy range cuts increase clarity
          if (band.frequency >= 200 && band.frequency <= 500 && band.gain < 0) {
            clarity += Math.abs(band.gain) * 6;
          }
        }
      });
    }

    return Math.min(100, Math.max(0, clarity));
  }

  private calculateAirValue(eq: any, spectrum: number[]): number {
    if (!eq?.enabled) return 0;
    
    let air = 0;
    
    if (eq.bands) {
      eq.bands.forEach((band: any) => {
        if (band.enabled && band.frequency >= 8000 && band.gain > 0) {
          air += band.gain * 10;
        }
      });
    }

    return Math.min(100, air);
  }

  private calculateWidthValue(stereoWidth: any, spectrum: number[]): number {
    if (!stereoWidth?.enabled) return 100; // Default width
    
    return Math.min(200, Math.max(0, stereoWidth.parameters.width || 100));
  }

  private generatePresetName(macroValues: PresetOutcome['macroValues'], analysisData: any): string {
    const traits: string[] = [];
    
    if (macroValues.punch > 70) traits.push('Punchy');
    if (macroValues.warmth > 60) traits.push('Warm');
    if (macroValues.clarity > 70) traits.push('Clear');
    if (macroValues.air > 50) traits.push('Bright');
    if (macroValues.width > 120) traits.push('Wide');
    
    const lufsCategory = analysisData.lufs > -10 ? 'Loud' : 
                        analysisData.lufs > -16 ? 'Radio' : 'Dynamic';
    
    const baseName = traits.length > 0 ? traits.join(' ') : 'Balanced';
    return `${baseName} ${lufsCategory}`;
  }

  private generateDescription(macroValues: PresetOutcome['macroValues'], analysisData: any): string {
    const characteristics: string[] = [];
    
    if (macroValues.punch > 60) characteristics.push('enhanced transients');
    if (macroValues.warmth > 50) characteristics.push('harmonic richness');
    if (macroValues.clarity > 60) characteristics.push('improved clarity');
    if (macroValues.air > 40) characteristics.push('high-frequency sparkle');
    if (macroValues.width > 110) characteristics.push('stereo width enhancement');
    
    const targetDesc = `targeting ${analysisData.lufs.toFixed(1)} LUFS`;
    
    return characteristics.length > 0 
      ? `Mix processing with ${characteristics.join(', ')}, ${targetDesc}`
      : `Balanced mix processing ${targetDesc}`;
  }

  private generateAutoTags(macroValues: PresetOutcome['macroValues'], chain: ProcessingChain): string[] {
    const tags: string[] = [];
    
    // Macro-based tags
    if (macroValues.punch > 70) tags.push('punchy', 'aggressive');
    if (macroValues.warmth > 60) tags.push('warm', 'vintage');
    if (macroValues.clarity > 70) tags.push('clear', 'defined');
    if (macroValues.air > 50) tags.push('bright', 'airy');
    if (macroValues.width > 130) tags.push('wide', 'spacious');
    
    // Module-based tags
    const enabledModules = chain.modules.filter(m => m.enabled);
    if (enabledModules.some(m => m.id === 'saturator')) tags.push('saturated');
    if (enabledModules.some(m => m.id === 'compressor')) tags.push('compressed');
    if (enabledModules.some(m => m.id === 'eq')) tags.push('eq-enhanced');
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private detectMixingStage(lufs: number, macroValues: PresetOutcome['macroValues']): 'rough' | 'polish' | 'master' {
    if (lufs > -8) return 'master'; // Heavily limited
    if (macroValues.punch > 60 || macroValues.clarity > 70) return 'polish';
    return 'rough';
  }

  private doesPresetMatchStyle(preset: PresetOutcome, style: string): boolean {
    const macros = preset.macroValues;
    
    switch (style) {
      case 'punchy':
        return macros.punch > 60;
      case 'warm':
        return macros.warmth > 50;
      case 'bright':
        return macros.air > 40 || macros.clarity > 60;
      case 'wide':
        return macros.width > 120;
      case 'clean':
        return macros.clarity > 70 && macros.punch < 40;
      case 'aggressive':
        return macros.punch > 70 && preset.targetLUFS > -12;
      default:
        return true;
    }
  }

  private doesPresetMatchMood(preset: PresetOutcome, mood: string): boolean {
    const macros = preset.macroValues;
    
    switch (mood) {
      case 'energetic':
        return macros.punch > 50 && macros.clarity > 50;
      case 'mellow':
        return macros.warmth > 60 && macros.punch < 50;
      case 'dramatic':
        return macros.punch > 60 && macros.width > 110;
      case 'intimate':
        return macros.warmth > 50 && macros.width < 110;
      default:
        return true;
    }
  }

  private doesPresetMatchLoudness(preset: PresetOutcome, loudness: string): boolean {
    switch (loudness) {
      case 'quiet':
        return preset.targetLUFS < -20;
      case 'moderate':
        return preset.targetLUFS >= -20 && preset.targetLUFS <= -14;
      case 'loud':
        return preset.targetLUFS > -14 && preset.targetLUFS <= -10;
      case 'maximum':
        return preset.targetLUFS > -10;
      default:
        return true;
    }
  }

  private calculateRelevanceScore(preset: PresetOutcome, criteria: any): number {
    let score = 0;
    
    // Tag matching
    if (criteria.style && preset.tags.includes(criteria.style)) score += 30;
    
    // Genre exact match
    if (criteria.genre && preset.usage.genre.includes(criteria.genre)) score += 25;
    
    // Partial matches
    Object.entries(criteria).forEach(([key, value]) => {
      if (preset.tags.some(tag => tag.includes(value as string))) {
        score += 10;
      }
    });
    
    return score;
  }

  private initializeFactoryPresets(): void {
    if (this.presets.length === 0) {
      // Add factory presets
      this.presets.push(
        {
          name: "Radio Ready Pop",
          description: "Bright, punchy mix optimized for streaming and radio",
          tags: ["pop", "radio", "bright", "punchy", "commercial"],
          macroValues: { punch: 75, warmth: 40, clarity: 80, air: 70, width: 120 },
          moduleStates: {
            'hpf': true,
            'eq': true,
            'compressor': true,
            'saturator': false,
            'stereo_width': true,
            'limiter': true
          },
          targetLUFS: -14,
          usage: { genre: ["pop", "dance"], stemTypes: ["all"], mixingStage: "master" }
        },
        {
          name: "Warm Vintage",
          description: "Analog-inspired warmth with musical dynamics",
          tags: ["vintage", "warm", "analog", "musical", "tube"],
          macroValues: { punch: 45, warmth: 85, clarity: 60, air: 30, width: 100 },
          moduleStates: {
            'hpf': false,
            'eq': true,
            'compressor': true,
            'saturator': true,
            'stereo_width': false,
            'limiter': true
          },
          targetLUFS: -18,
          usage: { genre: ["rock", "jazz", "blues"], stemTypes: ["all"], mixingStage: "polish" }
        },
        {
          name: "Crystal Clear",
          description: "Maximum clarity and definition for complex arrangements",
          tags: ["clear", "detailed", "precise", "clinical", "modern"],
          macroValues: { punch: 55, warmth: 20, clarity: 95, air: 80, width: 110 },
          moduleStates: {
            'hpf': true,
            'eq': true,
            'compressor': true,
            'saturator': false,
            'stereo_width': true,
            'limiter': true
          },
          targetLUFS: -16,
          usage: { genre: ["electronic", "classical"], stemTypes: ["all"], mixingStage: "polish" }
        }
      );
      
      this.savePresets();
    }
  }

  private loadPresets(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.presets = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load outcome presets:', error);
      this.presets = [];
    }
  }

  private savePresets(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.presets));
    } catch (error) {
      console.error('Failed to save outcome presets:', error);
    }
  }

  getAllPresets(): PresetOutcome[] {
    return [...this.presets];
  }

  deletePreset(name: string): boolean {
    const initialLength = this.presets.length;
    this.presets = this.presets.filter(p => p.name !== name);
    
    if (this.presets.length < initialLength) {
      this.savePresets();
      return true;
    }
    return false;
  }

  exportPresets(): string {
    return JSON.stringify(this.presets, null, 2);
  }

  importPresets(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);
      if (Array.isArray(imported)) {
        this.presets = imported;
        this.savePresets();
        return true;
      }
    } catch (error) {
      console.error('Failed to import presets:', error);
    }
    return false;
  }
}

export default OutcomePresetsManager;