import { TinyPreset, ModuleType } from './processingChain';

export const TINY_PRESETS: Record<ModuleType, TinyPreset[]> = {
  [ModuleType.HPF]: [
    {
      name: "Sub Clean",
      description: "Remove sub-bass rumble",
      parameters: { frequency: 30, slope: 12, resonance: 0.707 }
    },
    {
      name: "Mix Clean",
      description: "Standard mix cleaning",
      parameters: { frequency: 40, slope: 18, resonance: 0.707 }
    },
    {
      name: "Vocal Clean",
      description: "Vocal proximity effect removal",
      parameters: { frequency: 80, slope: 12, resonance: 0.707 }
    }
  ],

  [ModuleType.EQ]: [
    {
      name: "Analog Warm",
      description: "Vintage console character",
      parameters: { 
        "low_gain": 1.5, "low_freq": 80,
        "mid_gain": -0.5, "mid_freq": 400,
        "high_gain": 2.0, "high_freq": 10000
      }
    },
    {
      name: "Digital Bright",
      description: "Modern clarity and presence",
      parameters: {
        "low_gain": 0, "low_freq": 80,
        "mid_gain": 1.0, "mid_freq": 2000,
        "high_gain": 2.5, "high_freq": 8000
      }
    },
    {
      name: "Vocal Presence",
      description: "Forward vocal character",
      parameters: {
        "low_gain": -1.0, "low_freq": 200,
        "mid_gain": 2.0, "mid_freq": 1200,
        "high_gain": 1.5, "high_freq": 6000
      }
    },
    {
      name: "Bass Focus",
      description: "Tight low-end control",
      parameters: {
        "low_gain": 2.0, "low_freq": 60,
        "mid_gain": -1.5, "mid_freq": 300,
        "high_gain": 0, "high_freq": 8000
      }
    }
  ],

  [ModuleType.COMPRESSOR]: [
    {
      name: "Glue",
      description: "Gentle bus compression",
      parameters: { 
        threshold: -8, ratio: 2.5, attack: 30, release: 100,
        knee: 3, makeupGain: 2, lookahead: 5
      }
    },
    {
      name: "Punch",
      description: "Aggressive transient control",
      parameters: {
        threshold: -15, ratio: 6, attack: 1, release: 50,
        knee: 1, makeupGain: 4, lookahead: 0
      }
    },
    {
      name: "Vocal",
      description: "Smooth vocal leveling",
      parameters: {
        threshold: -12, ratio: 3, attack: 5, release: 80,
        knee: 2, makeupGain: 3, lookahead: 3
      }
    },
    {
      name: "Parallel",
      description: "Parallel compression blend",
      parameters: {
        threshold: -20, ratio: 10, attack: 0.1, release: 30,
        knee: 0, makeupGain: 8, lookahead: 0
      }
    }
  ],

  [ModuleType.SATURATOR]: [
    {
      name: "Tape Warm",
      description: "Analog tape saturation",
      parameters: { drive: 3, character: 'tape', mix: 30, outputGain: -1 }
    },
    {
      name: "Tube Glow",
      description: "Vacuum tube harmonics",
      parameters: { drive: 5, character: 'tube', mix: 40, outputGain: -2 }
    },
    {
      name: "Digital Edge",
      description: "Modern digital saturation",
      parameters: { drive: 2, character: 'bright', mix: 20, outputGain: 0 }
    },
    {
      name: "Vintage Thick",
      description: "Thick vintage character",
      parameters: { drive: 7, character: 'warm', mix: 50, outputGain: -3 }
    }
  ],

  [ModuleType.STEREO_WIDTH]: [
    {
      name: "Natural Wide",
      description: "Subtle width enhancement",
      parameters: { width: 120, bassMonoFreq: 120, bassMonoEnabled: true, correlation: 0.7 }
    },
    {
      name: "Super Wide",
      description: "Maximum stereo width",
      parameters: { width: 180, bassMonoFreq: 100, bassMonoEnabled: true, correlation: 0.3 }
    },
    {
      name: "Mono Safe",
      description: "Mono-compatible widening",
      parameters: { width: 110, bassMonoFreq: 150, bassMonoEnabled: true, correlation: 0.9 }
    },
    {
      name: "Focus Center",
      description: "Emphasize center content",
      parameters: { width: 80, bassMonoFreq: 200, bassMonoEnabled: true, correlation: 1.0 }
    }
  ],

  [ModuleType.LIMITER]: [
    {
      name: "Transparent",
      description: "Invisible limiting",
      parameters: { ceiling: -0.1, release: 50, isr: 4, character: 'transparent' }
    },
    {
      name: "Loud",
      description: "Maximum loudness",
      parameters: { ceiling: -0.1, release: 20, isr: 8, character: 'aggressive' }
    },
    {
      name: "Musical",
      description: "Musical program limiting",
      parameters: { ceiling: -0.3, release: 100, isr: 2, character: 'vintage' }
    },
    {
      name: "Broadcast",
      description: "Broadcasting standard",
      parameters: { ceiling: -1.0, release: 80, isr: 4, character: 'transparent' }
    }
  ],

  [ModuleType.TRANSIENT_SHAPER]: [
    {
      name: "More Attack",
      description: "Enhance transients",
      parameters: { attack: 30, sustain: 0, frequency: 1000, sensitivity: 50 }
    },
    {
      name: "Smooth",
      description: "Reduce harshness",
      parameters: { attack: -20, sustain: 10, frequency: 3000, sensitivity: 30 }
    },
    {
      name: "Punch",
      description: "Drum punch enhancement",
      parameters: { attack: 50, sustain: -10, frequency: 500, sensitivity: 70 }
    }
  ],

  [ModuleType.HARMONIC_EXCITER]: [
    {
      name: "Air",
      description: "High-frequency sparkle",
      parameters: { frequency: 8000, drive: 20, harmonics: 'even', mix: 25 }
    },
    {
      name: "Presence",
      description: "Midrange presence",
      parameters: { frequency: 2000, drive: 15, harmonics: 'odd', mix: 30 }
    },
    {
      name: "Warmth",
      description: "Low-mid warmth",
      parameters: { frequency: 300, drive: 25, harmonics: 'even', mix: 20 }
    }
  ]
};

export class TinyPresetsManager {
  private favorites: Map<string, TinyPreset> = new Map();
  private recentlyUsed: TinyPreset[] = [];
  private maxRecent: number = 10;

  addToFavorites(preset: TinyPreset, moduleType: ModuleType): void {
    const key = `${moduleType}_${preset.name}`;
    this.favorites.set(key, preset);
    this.saveFavorites();
  }

  removeFromFavorites(preset: TinyPreset, moduleType: ModuleType): void {
    const key = `${moduleType}_${preset.name}`;
    this.favorites.delete(key);
    this.saveFavorites();
  }

  isFavorite(preset: TinyPreset, moduleType: ModuleType): boolean {
    const key = `${moduleType}_${preset.name}`;
    return this.favorites.has(key);
  }

  getFavorites(moduleType: ModuleType): TinyPreset[] {
    const typePrefix = `${moduleType}_`;
    return Array.from(this.favorites.entries())
      .filter(([key]) => key.startsWith(typePrefix))
      .map(([, preset]) => preset);
  }

  addToRecent(preset: TinyPreset): void {
    // Remove if already exists
    this.recentlyUsed = this.recentlyUsed.filter(p => p.name !== preset.name);
    
    // Add to beginning
    this.recentlyUsed.unshift(preset);
    
    // Limit size
    if (this.recentlyUsed.length > this.maxRecent) {
      this.recentlyUsed = this.recentlyUsed.slice(0, this.maxRecent);
    }
    
    this.saveRecent();
  }

  getRecentlyUsed(): TinyPreset[] {
    return [...this.recentlyUsed];
  }

  createCustomPreset(
    name: string, 
    description: string, 
    parameters: Record<string, number | boolean | string>
  ): TinyPreset {
    return { name, description, parameters };
  }

  private saveFavorites(): void {
    const favoritesData = Object.fromEntries(this.favorites);
    localStorage.setItem('tiny_presets_favorites', JSON.stringify(favoritesData));
  }

  private saveRecent(): void {
    localStorage.setItem('tiny_presets_recent', JSON.stringify(this.recentlyUsed));
  }

  loadUserData(): void {
    try {
      const favoritesData = localStorage.getItem('tiny_presets_favorites');
      if (favoritesData) {
        const parsed = JSON.parse(favoritesData);
        this.favorites = new Map(Object.entries(parsed));
      }

      const recentData = localStorage.getItem('tiny_presets_recent');
      if (recentData) {
        this.recentlyUsed = JSON.parse(recentData);
      }
    } catch (error) {
      console.error('Failed to load tiny presets user data:', error);
    }
  }
}

export function getPresetsByModule(moduleType: ModuleType): TinyPreset[] {
  return TINY_PRESETS[moduleType] || [];
}

export function findPresetByName(moduleType: ModuleType, name: string): TinyPreset | undefined {
  return TINY_PRESETS[moduleType]?.find(preset => preset.name === name);
}