export interface ProcessingModule {
  id: string;
  name: string;
  enabled: boolean;
  parameters: Record<string, number | boolean | string>;
  preset?: TinyPreset;
}

export interface TinyPreset {
  name: string;
  description: string;
  parameters: Record<string, number | boolean | string>;
}

export interface ProcessingChain {
  modules: ProcessingModule[];
  globalSettings: {
    snapshots: GlobalSnapshot[];
    currentSnapshot: number;
    gainMatch: boolean;
    ducking: DuckingSettings;
  };
}

export interface GlobalSnapshot {
  id: string;
  name: string;
  timestamp: number;
  chain: ProcessingModule[];
  lufsReference?: number;
}

export interface DuckingSettings {
  enabled: boolean;
  sourceFreqMin: number; // 1 kHz default
  sourceFreqMax: number; // 4 kHz default
  targetStem: string; // Music stem ID
  sourceStem: string; // Lead Vox stem ID
  assistantValue: number; // 0.8 (80%) default
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

export enum ModuleType {
  HPF = 'hpf',
  EQ = 'eq',
  COMPRESSOR = 'compressor',
  SATURATOR = 'saturator',
  STEREO_WIDTH = 'stereo_width',
  LIMITER = 'limiter',
  TRANSIENT_SHAPER = 'transient_shaper',
  HARMONIC_EXCITER = 'harmonic_exciter'
}

export interface EQBand {
  id: string;
  frequency: number;
  gain: number;
  q: number;
  type: 'bell' | 'highpass' | 'lowpass' | 'highshelf' | 'lowshelf';
  enabled: boolean;
  isDynamic: boolean;
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  midSideMode: 'stereo' | 'mid' | 'side';
}

export interface DynamicEQModule extends ProcessingModule {
  bands: EQBand[];
  globalMidSide: boolean;
  analyzerEnabled: boolean;
}

export interface SpectrumAnalysis {
  frequencies: number[];
  magnitudes: number[];
  mixSpectrum: number[];
  referenceSpectrum?: number[];
  smoothing: number;
  maskingData?: MaskingHeatmap;
}

export interface MaskingHeatmap {
  stems: string[];
  frequencies: number[];
  maskingMatrix: number[][]; // stem x frequency conflicts
  conflictLevel: 'low' | 'medium' | 'high';
}

export interface LUFSMetering {
  integrated: number;
  shortTerm: number;
  momentary: number;
  peak: number;
  range: number;
  gatingEnabled: boolean;
}

export interface AnalysisFeatures {
  spectrum: SpectrumAnalysis;
  lufs: LUFSMetering;
  correlation: number;
  vectorscope: { l: number; r: number }[];
  phaseCoherence: number;
  monoCompatibility: number;
  dcOffset: number;
}

export interface SuggestionEngine {
  analyzeStems(stems: string[]): Promise<ProcessingSuggestion[]>;
  detectInstruments(audioBuffer: AudioBuffer): Promise<string>;
  suggestEQCurve(spectrum: number[]): EQBand[];
  suggestCompression(dynamics: number[]): Partial<ProcessingModule>;
}

export interface ProcessingSuggestion {
  moduleType: ModuleType;
  confidence: number;
  description: string;
  parameters: Record<string, number | boolean | string>;
  reasoning: string;
}

export interface PresetOutcome {
  name: string;
  description: string;
  tags: string[];
  macroValues: {
    punch: number;
    warmth: number;
    clarity: number;
    air: number;
    width: number;
  };
  moduleStates: Record<string, boolean>;
  targetLUFS: number;
  usage: {
    genre: string[];
    stemTypes: string[];
    mixingStage: 'rough' | 'polish' | 'master';
  };
}