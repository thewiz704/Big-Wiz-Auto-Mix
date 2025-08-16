import { MixerSettings, StemRole } from './types';

export interface MacroProcessingResult {
  eqCurve: EQBand[];
  compression: CompressionSettings;
  saturation: SaturationSettings;
  stereoWidth: StereoWidthSettings;
  limiterSettings: LimiterSettings;
  reverbSend: number;
}

export interface EQBand {
  frequency: number;
  gain: number;
  q: number;
  type: 'bell' | 'highshelf' | 'lowshelf' | 'highpass' | 'lowpass';
  enabled: boolean;
}

export interface CompressionSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  enabled: boolean;
}

export interface SaturationSettings {
  drive: number;
  character: 'tube' | 'tape' | 'transistor';
  mix: number;
  enabled: boolean;
}

export interface StereoWidthSettings {
  width: number; // percentage (100 = normal, 200 = wide, 0 = mono)
  bassMonoFreq: number;
  sideLowCut: number;
  enabled: boolean;
}

export interface LimiterSettings {
  ceiling: number; // dBFS
  release: number; // ms
  lookahead: number; // ms
  enabled: boolean;
}

export class MacroProcessor {
  /**
   * Converts macro slider values into concrete DSP parameters
   * Based on the technical specifications provided
   */
  static processSettingsToChain(
    settings: MixerSettings, 
    stemRole?: StemRole
  ): MacroProcessingResult {
    const result: MacroProcessingResult = {
      eqCurve: [],
      compression: this.getDefaultCompression(),
      saturation: this.getDefaultSaturation(),
      stereoWidth: this.getDefaultStereoWidth(),
      limiterSettings: this.getDefaultLimiter(),
      reverbSend: settings.reverb
    };

    // 1) CLARITY: +1-4 dB high-shelf @ 6-10 kHz, optional -1-2 dB at 300-400 Hz
    if (settings.clarity > 0) {
      const clarityGain = this.mapRange(settings.clarity, 0, 100, 0, 4);
      
      // High-shelf boost for presence
      result.eqCurve.push({
        frequency: 8000,
        gain: clarityGain,
        q: 0.7,
        type: 'highshelf',
        enabled: true
      });

      // Optional mud reduction if clarity is high
      if (settings.clarity > 50) {
        const mudCut = this.mapRange(settings.clarity, 50, 100, 0, -2);
        result.eqCurve.push({
          frequency: 350,
          gain: mudCut,
          q: 1.2,
          type: 'bell',
          enabled: true
        });
      }
    }

    // 2) PUNCH: bus comp 1.3-2:1, 10-30 ms attack, auto makeup; percussive stems get slightly faster attack
    if (settings.punch > 0) {
      const punchAmount = settings.punch / 100;
      
      result.compression = {
        threshold: this.mapRange(settings.punch, 0, 100, -3, -15),
        ratio: this.mapRange(settings.punch, 0, 100, 1.3, 2.1),
        attack: this.isPercussive(stemRole) 
          ? this.mapRange(settings.punch, 0, 100, 30, 10) 
          : this.mapRange(settings.punch, 0, 100, 30, 15),
        release: this.mapRange(settings.punch, 0, 100, 50, 150),
        makeupGain: this.mapRange(settings.punch, 0, 100, 0, 3),
        enabled: settings.punch > 5
      };
    }

    // 3) WARMTH: -1-3 dB @ 3-5 kHz and +0.5-2 dB low-shelf @ 120-200 Hz; add tiny harmonic sat on music bus
    if (settings.warmth > 0) {
      const warmthAmount = settings.warmth / 100;
      
      // Low-shelf warmth boost
      const lowBoost = this.mapRange(settings.warmth, 0, 100, 0, 2);
      result.eqCurve.push({
        frequency: 160,
        gain: lowBoost,
        q: 0.7,
        type: 'lowshelf',
        enabled: true
      });

      // Mid reduction to avoid harshness
      const midCut = this.mapRange(settings.warmth, 0, 100, 0, -3);
      result.eqCurve.push({
        frequency: 4000,
        gain: midCut,
        q: 1.0,
        type: 'bell',
        enabled: true
      });

      // Harmonic saturation
      result.saturation = {
        drive: this.mapRange(settings.warmth, 0, 100, 0, 2),
        character: 'tube',
        mix: this.mapRange(settings.warmth, 0, 100, 0, 25),
        enabled: settings.warmth > 10
      };
    }

    // 4) WIDTH: scale mid/side side gain (-50%…+50%); keep mono-safe guard
    if (settings.width !== 0) {
      result.stereoWidth = {
        width: this.mapRange(settings.width, 0, 100, 50, 150),
        bassMonoFreq: 120, // Keep bass mono for stability
        sideLowCut: 100, // Cut low frequencies from side channel
        enabled: true
      };
    }

    // 5) AIR: +0.5-3 dB shelf @ 12-16 kHz; negative backs it off
    if (settings.air !== 0) {
      const airGain = this.mapRange(settings.air, 0, 100, 0, 3);
      result.eqCurve.push({
        frequency: 14000,
        gain: airGain,
        q: 0.5,
        type: 'highshelf',
        enabled: true
      });
    }

    // 6) GLUE: slow bus comp + very small soft-clip before the limiter (0.5-1.5 dB GR target)
    if (settings.punch > 0) { // Glue is implemented through the punch compression with slower settings
      // Adjust compression for glue characteristics
      result.compression.attack = Math.max(result.compression.attack, 20);
      result.compression.release = Math.max(result.compression.release, 100);
      
      // Soft clipping before limiter
      result.saturation.drive = Math.max(result.saturation.drive, 0.5);
      result.saturation.character = 'tape';
    }

    return result;
  }

  /**
   * Generate per-role specific processing chains
   * Based on stem analysis and role-appropriate processing
   */
  static getPerRoleChain(role: StemRole, settings: MixerSettings): MacroProcessingResult {
    const baseChain = this.processSettingsToChain(settings, role);
    
    switch (role) {
      case StemRole.KICK:
        return this.enhanceForKick(baseChain, settings);
      case StemRole.SNARE:
        return this.enhanceForSnare(baseChain, settings);
      case StemRole.BASS:
        return this.enhanceForBass(baseChain, settings);
      case StemRole.VOCAL:
      case StemRole.LEAD:
        return this.enhanceForVocal(baseChain, settings);
      case StemRole.DRUMS:
        return this.enhanceForDrums(baseChain, settings);
      default:
        return baseChain;
    }
  }

  private static enhanceForKick(chain: MacroProcessingResult, settings: MixerSettings): MacroProcessingResult {
    // Add kick-specific processing
    
    // Sub-bass focus
    chain.eqCurve.unshift({
      frequency: 60,
      gain: this.mapRange(settings.punch, 0, 100, 0, 2),
      q: 1.0,
      type: 'bell',
      enabled: true
    });

    // Click enhancement if clarity is high
    if (settings.clarity > 50) {
      chain.eqCurve.push({
        frequency: 4000,
        gain: this.mapRange(settings.clarity, 50, 100, 0, 1.5),
        q: 1.5,
        type: 'bell',
        enabled: true
      });
    }

    // Tighter compression for punch
    chain.compression.attack = Math.min(chain.compression.attack, 5);
    chain.compression.ratio = Math.max(chain.compression.ratio, 3);

    return chain;
  }

  private static enhanceForSnare(chain: MacroProcessingResult, settings: MixerSettings): MacroProcessingResult {
    // Snare body enhancement
    chain.eqCurve.unshift({
      frequency: 250,
      gain: this.mapRange(settings.punch, 0, 100, 0, 2),
      q: 1.2,
      type: 'bell',
      enabled: true
    });

    // Crack enhancement
    if (settings.clarity > 30) {
      chain.eqCurve.push({
        frequency: 5000,
        gain: this.mapRange(settings.clarity, 30, 100, 0, 3),
        q: 2.0,
        type: 'bell',
        enabled: true
      });
    }

    return chain;
  }

  private static enhanceForBass(chain: MacroProcessingResult, settings: MixerSettings): MacroProcessingResult {
    // Keep bass mono
    chain.stereoWidth.width = Math.min(chain.stereoWidth.width, 100);
    
    // Fundamental enhancement
    chain.eqCurve.unshift({
      frequency: 100,
      gain: this.mapRange(settings.warmth, 0, 100, 0, 2),
      q: 1.0,
      type: 'bell',
      enabled: true
    });

    // Harmonic enhancement for cut-through
    if (settings.clarity > 40) {
      chain.eqCurve.push({
        frequency: 800,
        gain: this.mapRange(settings.clarity, 40, 100, 0, 1.5),
        q: 1.0,
        type: 'bell',
        enabled: true
      });
    }

    return chain;
  }

  private static enhanceForVocal(chain: MacroProcessingResult, settings: MixerSettings): MacroProcessingResult {
    // Presence boost
    chain.eqCurve.unshift({
      frequency: 3000,
      gain: this.mapRange(settings.clarity, 0, 100, 0, 3),
      q: 1.2,
      type: 'bell',
      enabled: settings.clarity > 20
    });

    // De-essing if clarity is very high
    if (settings.clarity > 70) {
      chain.eqCurve.push({
        frequency: 7000,
        gain: -1.5,
        q: 2.0,
        type: 'bell',
        enabled: true
      });
    }

    // Gentle compression for consistency
    chain.compression.threshold = Math.max(chain.compression.threshold, -12);
    chain.compression.ratio = Math.min(chain.compression.ratio, 3);
    chain.compression.attack = Math.max(chain.compression.attack, 5);

    return chain;
  }

  private static enhanceForDrums(chain: MacroProcessingResult, settings: MixerSettings): MacroProcessingResult {
    // Overall drum processing
    
    // Transient enhancement
    if (settings.punch > 50) {
      chain.compression.attack = Math.min(chain.compression.attack, 3);
    }

    // Cymbal control
    if (settings.air > 60) {
      chain.eqCurve.push({
        frequency: 10000,
        gain: -1,
        q: 1.5,
        type: 'bell',
        enabled: true
      });
    }

    return chain;
  }

  private static mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
  }

  private static isPercussive(role?: StemRole): boolean {
    return role === StemRole.KICK || role === StemRole.SNARE || role === StemRole.DRUMS || role === StemRole.PERCUSSION || role === StemRole.HIHAT;
  }

  private static getDefaultCompression(): CompressionSettings {
    return {
      threshold: 0,
      ratio: 1,
      attack: 30,
      release: 100,
      makeupGain: 0,
      enabled: false
    };
  }

  private static getDefaultSaturation(): SaturationSettings {
    return {
      drive: 0,
      character: 'tube',
      mix: 0,
      enabled: false
    };
  }

  private static getDefaultStereoWidth(): StereoWidthSettings {
    return {
      width: 100,
      bassMonoFreq: 120,
      sideLowCut: 100,
      enabled: false
    };
  }

  private static getDefaultLimiter(): LimiterSettings {
    return {
      ceiling: -0.1,
      release: 50,
      lookahead: 5,
      enabled: true
    };
  }

  /**
   * Create preset with actual different parameters (not just LUFS/width changes)
   * Implements the example deltas from the specifications
   */
  static createPresetDeltas(presetName: string): Partial<MixerSettings> {
    const presetDeltas: Record<string, Partial<MixerSettings>> = {
      'Vocal-up': {
        // vocal presence shelf +2 dB, music band-duck 1-2 dB @ 1-4 kHz, bus width +0.05, reverb send +10%
        clarity: 60, // +2dB presence shelf
        warmth: 30,  // slight band-duck in mids
        width: 55,   // +0.05 width
        reverb: 70   // +10% reverb
      },
      'Warm & Wide': {
        // high-shelf +1 dB, low-shelf +0.5 dB, width +0.1, slower bus release, hats HPF 300-400 Hz
        air: 35,     // +1dB high-shelf
        warmth: 75,  // +0.5dB low-shelf + slower release
        width: 65,   // +0.1 width
        clarity: 25, // HPF for hats
        punch: 40    // slower bus compression
      },
      'Club-Ready': {
        // kick 50/100 Hz peaking +2 dB, bass sat +2 dB, bus comp ratio 1.7:1, TP ceiling -1 dBTP
        punch: 85,   // ratio 1.7:1, kick peaking
        warmth: 60,  // bass sat +2dB
        clarity: 45, // maintain clarity
        width: 70    // club width
      }
    };

    return presetDeltas[presetName] || {};
  }

  /**
   * Apply gain compensation per macro so A/B is fair
   * Compensates for level changes when applying processing
   */
  static calculateGainCompensation(settings: MixerSettings): number {
    let compensation = 0;

    // Compensate for EQ boosts
    compensation -= settings.clarity * 0.02; // High-shelf boost compensation
    compensation -= settings.warmth * 0.015; // Low-shelf boost compensation  
    compensation -= settings.air * 0.02;     // Air shelf compensation

    // Compensate for compression makeup gain
    compensation -= settings.punch * 0.025;

    // Compensate for saturation level increase
    compensation -= settings.warmth * 0.01; // Saturation compensation

    return Math.max(-6, Math.min(6, compensation)); // Limit to ±6dB
  }
}

export default MacroProcessor;