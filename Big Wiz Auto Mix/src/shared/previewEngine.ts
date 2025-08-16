import { AudioEffectsEngine, EffectChain } from './audioEffectsEngine';
import { MacroProcessor } from './macroProcessor';
import { MixerSettings, StemFile } from './types';

export interface PreviewState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  gainMatchEnabled: boolean;
  referenceGain: number;
}

export class PreviewEngine {
  private audioContext: AudioContext;
  private effectsEngine: AudioEffectsEngine;
  private sourceNodes: Map<string, AudioBufferSourceNode> = new Map();
  private stemBuffers: Map<string, AudioBuffer> = new Map();
  private masterGain: GainNode;
  private analyzerNode: AnalyserNode;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private currentSettings: MixerSettings;
  private gainMatchReference: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.effectsEngine = new AudioEffectsEngine(audioContext);
    this.masterGain = audioContext.createGain();
    this.analyzerNode = audioContext.createAnalyser();
    
    // Connect master output
    this.masterGain.connect(this.analyzerNode);
    this.analyzerNode.connect(audioContext.destination);
    
    // Set analyzer properties
    this.analyzerNode.fftSize = 2048;
    this.analyzerNode.smoothingTimeConstant = 0.8;

    this.currentSettings = this.getDefaultSettings();
  }

  /**
   * Load stems for preview
   */
  async loadStems(stems: StemFile[]): Promise<void> {
    // Clear existing buffers
    this.stemBuffers.clear();
    this.stopPlayback();

    for (const stem of stems) {
      if (stem.path) {
        try {
          const response = await fetch(stem.path);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.stemBuffers.set(stem.id, audioBuffer);
        } catch (error) {
          console.error(`Failed to load stem ${stem.name}:`, error);
        }
      }
    }

    console.log(`Loaded ${this.stemBuffers.size} stems for preview`);
  }

  /**
   * Start playback with current settings
   */
  async play(settings?: MixerSettings, stems?: StemFile[]): Promise<void> {
    if (this.isPlaying) {
      this.stopPlayback();
    }

    if (settings) {
      this.currentSettings = settings;
    }

    if (this.stemBuffers.size === 0) {
      console.warn('No stems loaded for playback');
      return;
    }

    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime - this.pauseTime;

    // Create source nodes and effect chains for each stem
    for (const [stemId, buffer] of this.stemBuffers.entries()) {
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.loop = true; // Loop for continuous preview

      // Find stem data
      const stemData = stems?.find(s => s.id === stemId);
      
      // Create processing chain based on current settings and stem role
      const processingResult = stemData?.role 
        ? MacroProcessor.getPerRoleChain(stemData.role, this.currentSettings)
        : MacroProcessor.processSettingsToChain(this.currentSettings);

      // Apply gain compensation if gain match is enabled
      if (this.gainMatchReference > 0) {
        const compensation = MacroProcessor.calculateGainCompensation(this.currentSettings);
        processingResult.compression.makeupGain += compensation;
      }

      const effectChain = this.effectsEngine.createEffectChain(stemId, processingResult);

      // Apply stem-specific settings
      if (stemData) {
        const stemGain = this.audioContext.createGain();
        stemGain.gain.setValueAtTime(
          this.dbToLinear(stemData.gain) * (stemData.muted ? 0 : 1),
          this.audioContext.currentTime
        );

        // Chain: source → stem gain → effects → master
        sourceNode.connect(stemGain);
        stemGain.connect(effectChain.getInputNode());
        effectChain.getOutputNode().connect(this.masterGain);
      } else {
        // Direct connection if no stem data
        sourceNode.connect(effectChain.getInputNode());
        effectChain.getOutputNode().connect(this.masterGain);
      }

      // Start playback
      sourceNode.start(0, this.pauseTime);
      this.sourceNodes.set(stemId, sourceNode);

      // Handle ended event
      sourceNode.onended = () => {
        if (this.isPlaying) {
          this.sourceNodes.delete(stemId);
          this.effectsEngine.removeEffectChain(stemId);
        }
      };
    }

    console.log('Playback started with macro processing');
  }

  /**
   * Update settings and re-preview (hot-swappable)
   */
  async updateSettings(newSettings: MixerSettings, stems?: StemFile[]): Promise<void> {
    this.currentSettings = newSettings;

    if (this.isPlaying && this.sourceNodes.size > 0) {
      // Hot-swap the processing without stopping playback
      for (const [stemId] of this.sourceNodes.entries()) {
        const stemData = stems?.find(s => s.id === stemId);
        
        const processingResult = stemData?.role 
          ? MacroProcessor.getPerRoleChain(stemData.role, newSettings)
          : MacroProcessor.processSettingsToChain(newSettings);

        // Apply gain compensation if enabled
        if (this.gainMatchReference > 0) {
          const compensation = MacroProcessor.calculateGainCompensation(newSettings);
          processingResult.compression.makeupGain += compensation;
        }

        // Update effect chain
        this.effectsEngine.createEffectChain(stemId, processingResult);
      }

      console.log('Settings updated during playback');
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.isPlaying) {
      this.pauseTime = this.audioContext.currentTime - this.startTime;
      this.stopPlayback();
    }
  }

  /**
   * Stop playback completely
   */
  stop(): void {
    this.pauseTime = 0;
    this.stopPlayback();
  }

  /**
   * Seek to specific time
   */
  seekTo(time: number): void {
    this.pauseTime = time;
    if (this.isPlaying) {
      // Restart playback from new position
      this.stopPlayback();
      this.play();
    }
  }

  /**
   * Enable/disable gain matching for fair A/B comparison
   */
  setGainMatch(enabled: boolean, referenceSettings?: MixerSettings): void {
    if (enabled && referenceSettings) {
      // Calculate reference gain from baseline settings
      this.gainMatchReference = this.calculateRMSLevel(referenceSettings);
    } else {
      this.gainMatchReference = 0;
    }

    console.log(`Gain match ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current playback state
   */
  getState(): PreviewState {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.isPlaying ? this.audioContext.currentTime - this.startTime : this.pauseTime,
      duration: this.getDuration(),
      gainMatchEnabled: this.gainMatchReference > 0,
      referenceGain: this.gainMatchReference
    };
  }

  /**
   * Get real-time analysis data
   */
  getAnalysisData(): { spectrum: number[]; lufs: number; peak: number } {
    const bufferLength = this.analyzerNode.frequencyBinCount;
    const spectrum = new Float32Array(bufferLength);
    const timeData = new Float32Array(bufferLength);
    
    this.analyzerNode.getFloatFrequencyData(spectrum);
    this.analyzerNode.getFloatTimeDomainData(timeData);

    // Calculate peak level
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      peak = Math.max(peak, Math.abs(timeData[i]));
    }

    // Simple LUFS approximation (not true ITU-R BS.1770 but good enough for preview)
    const rms = Math.sqrt(timeData.reduce((sum, sample) => sum + sample * sample, 0) / timeData.length);
    const lufs = 20 * Math.log10(rms + 1e-10) - 23; // Approximate LUFS

    return {
      spectrum: Array.from(spectrum),
      lufs: Math.max(-60, lufs),
      peak: 20 * Math.log10(peak + 1e-10)
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stopPlayback();
    this.effectsEngine.dispose();
    this.masterGain.disconnect();
    this.analyzerNode.disconnect();
  }

  private stopPlayback(): void {
    this.isPlaying = false;

    // Stop all source nodes
    this.sourceNodes.forEach(sourceNode => {
      try {
        sourceNode.stop();
        sourceNode.disconnect();
      } catch (error) {
        // Already stopped
      }
    });

    this.sourceNodes.clear();

    // Clean up effect chains
    this.effectsEngine.dispose();
  }

  private getDuration(): number {
    if (this.stemBuffers.size === 0) return 0;
    
    // Return duration of longest stem
    let maxDuration = 0;
    this.stemBuffers.forEach(buffer => {
      maxDuration = Math.max(maxDuration, buffer.duration);
    });
    
    return maxDuration;
  }

  private calculateRMSLevel(settings: MixerSettings): number {
    // Simple approximation of RMS level change from settings
    let level = 0;
    
    level += settings.punch * 0.02;  // Compression adds level
    level += settings.warmth * 0.01; // EQ boosts add level
    level += settings.clarity * 0.015;
    level += settings.air * 0.01;
    
    return level;
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  private getDefaultSettings(): MixerSettings {
    return {
      previewLUFS: -18,
      streamLUFS: -14,
      peakCeiling: -1,
      punch: 0,
      warmth: 0,
      clarity: 0,
      air: 0,
      width: 0,
      reverb: 0
    };
  }
}

export default PreviewEngine;