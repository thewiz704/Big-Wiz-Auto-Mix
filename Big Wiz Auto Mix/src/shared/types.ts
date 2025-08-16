export interface StemFile {
  id: string;
  name: string;
  path: string;
  role: StemRole;
  waveform?: number[];
  duration?: number;
  gain: number;
  muted: boolean;
  solo: boolean;
  pan: number; // -100 to +100
  autoSpread?: boolean;
  x?: number; // Visual mixer position
  y?: number; // Visual mixer position
}

export enum StemRole {
  KICK = 'kick',
  SNARE = 'snare',
  HIHAT = 'hihat',
  DRUMS = 'drums',
  PERCUSSION = 'percussion',
  BASS = 'bass',
  LEAD = 'lead',
  PAD = 'pad',
  ARPEGGIO = 'arpeggio',
  VOCAL = 'vocal',
  HARMONY = 'harmony',
  FX = 'fx',
  OTHER = 'other'
}

export interface MixerSettings {
  previewLUFS: number;
  streamLUFS: number;
  peakCeiling: number;
  punch: number;
  warmth: number;
  clarity: number;
  air: number;
  width: number;
  reverb: number;
}

export interface PresetProfile {
  id: string;
  name: string;
  description: string;
  settings: MixerSettings;
}

export interface AnalysisData {
  spectrum: number[];
  vectorscope: { l: number; r: number }[];
  lufs: number;
  peak: number;
  referenceSpectrum?: number[];
}

export interface SessionData {
  version: string;
  timestamp: string;
  stems: StemFile[];
  mixerSettings: MixerSettings;
  projectName?: string;
}