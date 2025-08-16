import { DuckingSettings } from './processingChain';

export class SidechainDucker {
  private audioContext: AudioContext;
  private sourceStemNode: GainNode | null = null;
  private targetStemNode: GainNode | null = null;
  private bandPassFilter: BiquadFilterNode;
  private highPassFilter: BiquadFilterNode;
  private lowPassFilter: BiquadFilterNode;
  private analyser: AnalyserNode;
  private compressor: DynamicsCompressorNode;
  private envelopeFollower: EnvelopeFollower;
  private isActive: boolean = false;
  private settings: DuckingSettings;

  constructor(audioContext: AudioContext, initialSettings: DuckingSettings) {
    this.audioContext = audioContext;
    this.settings = { ...initialSettings };
    
    // Create frequency-specific sidechain path
    this.bandPassFilter = audioContext.createBiquadFilter();
    this.highPassFilter = audioContext.createBiquadFilter();
    this.lowPassFilter = audioContext.createBiquadFilter();
    this.analyser = audioContext.createAnalyser();
    this.compressor = audioContext.createDynamicsCompressor();
    this.envelopeFollower = new EnvelopeFollower(audioContext);
    
    this.setupFilters();
    this.setupCompressor();
  }

  private setupFilters(): void {
    // High-pass filter at sourceFreqMin (default 1kHz)
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.setValueAtTime(
      this.settings.sourceFreqMin, 
      this.audioContext.currentTime
    );
    this.highPassFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);

    // Low-pass filter at sourceFreqMax (default 4kHz)
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.setValueAtTime(
      this.settings.sourceFreqMax, 
      this.audioContext.currentTime
    );
    this.lowPassFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);

    // Chain the filters to create band-pass
    this.highPassFilter.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.analyser);
    this.analyser.connect(this.envelopeFollower.getInputNode());
  }

  private setupCompressor(): void {
    this.compressor.threshold.setValueAtTime(
      this.settings.threshold, 
      this.audioContext.currentTime
    );
    this.compressor.ratio.setValueAtTime(
      this.settings.ratio, 
      this.audioContext.currentTime
    );
    this.compressor.attack.setValueAtTime(
      this.settings.attack / 1000, // Convert ms to seconds
      this.audioContext.currentTime
    );
    this.compressor.release.setValueAtTime(
      this.settings.release / 1000, // Convert ms to seconds
      this.audioContext.currentTime
    );
  }

  configure(newSettings: Partial<DuckingSettings>): void {
    Object.assign(this.settings, newSettings);
    
    // Update filter frequencies if changed
    if (newSettings.sourceFreqMin !== undefined) {
      this.highPassFilter.frequency.setTargetAtTime(
        newSettings.sourceFreqMin,
        this.audioContext.currentTime,
        0.01
      );
    }
    
    if (newSettings.sourceFreqMax !== undefined) {
      this.lowPassFilter.frequency.setTargetAtTime(
        newSettings.sourceFreqMax,
        this.audioContext.currentTime,
        0.01
      );
    }
    
    // Update compressor settings
    if (newSettings.threshold !== undefined) {
      this.compressor.threshold.setTargetAtTime(
        newSettings.threshold,
        this.audioContext.currentTime,
        0.01
      );
    }
    
    if (newSettings.ratio !== undefined) {
      this.compressor.ratio.setTargetAtTime(
        newSettings.ratio,
        this.audioContext.currentTime,
        0.01
      );
    }
    
    if (newSettings.attack !== undefined) {
      this.compressor.attack.setTargetAtTime(
        newSettings.attack / 1000,
        this.audioContext.currentTime,
        0.01
      );
    }
    
    if (newSettings.release !== undefined) {
      this.compressor.release.setTargetAtTime(
        newSettings.release / 1000,
        this.audioContext.currentTime,
        0.01
      );
    }
    
    // Update envelope follower sensitivity based on assistant value
    this.envelopeFollower.setSensitivity(this.settings.assistantValue);
  }

  connectSource(sourceNode: AudioNode): void {
    if (this.sourceStemNode) {
      this.disconnect();
    }
    
    // Create a new gain node for the source stem
    this.sourceStemNode = this.audioContext.createGain();
    sourceNode.connect(this.sourceStemNode);
    
    // Connect to the sidechain path
    this.sourceStemNode.connect(this.highPassFilter);
    
    this.updateDucking();
  }

  connectTarget(targetNode: AudioNode): GainNode {
    // Create a gain node that will be controlled by the ducking
    this.targetStemNode = this.audioContext.createGain();
    targetNode.connect(this.targetStemNode);
    
    this.updateDucking();
    
    return this.targetStemNode;
  }

  private updateDucking(): void {
    if (!this.settings.enabled || !this.sourceStemNode || !this.targetStemNode) {
      return;
    }

    // Use envelope follower to control target gain
    this.envelopeFollower.onLevelChange = (level: number) => {
      if (!this.targetStemNode) return;
      
      // Calculate ducking amount based on source level and assistant value
      const duckingAmount = level * this.settings.assistantValue;
      const targetGain = 1 - duckingAmount;
      
      // Apply smooth gain changes
      this.targetStemNode.gain.setTargetAtTime(
        Math.max(0.1, targetGain), // Minimum 10% volume
        this.audioContext.currentTime,
        0.01 // Smooth transition
      );
    };

    this.isActive = true;
  }

  enable(): void {
    this.settings.enabled = true;
    this.updateDucking();
  }

  disable(): void {
    this.settings.enabled = false;
    if (this.targetStemNode) {
      this.targetStemNode.gain.setTargetAtTime(
        1, // Restore full volume
        this.audioContext.currentTime,
        0.05
      );
    }
    this.isActive = false;
  }

  disconnect(): void {
    if (this.sourceStemNode) {
      this.sourceStemNode.disconnect();
      this.sourceStemNode = null;
    }
    
    if (this.targetStemNode) {
      this.targetStemNode.disconnect();
      this.targetStemNode = null;
    }
    
    this.isActive = false;
  }

  getAnalysisData(): {
    sourceLevel: number;
    targetGain: number;
    duckingActive: boolean;
    settings: DuckingSettings;
  } {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS level of the filtered source
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const sourceLevel = Math.sqrt(sum / dataArray.length);
    
    const targetGain = this.targetStemNode ? this.targetStemNode.gain.value : 1;
    
    return {
      sourceLevel,
      targetGain,
      duckingActive: this.isActive && this.settings.enabled,
      settings: { ...this.settings }
    };
  }

  dispose(): void {
    this.disconnect();
    this.envelopeFollower.dispose();
  }
}

class EnvelopeFollower {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private rectifier: WaveShaperNode;
  private smoother: BiquadFilterNode;
  private analyser: AnalyserNode;
  private sensitivity: number = 0.8;
  private updateInterval: number | null = null;
  
  public onLevelChange: ((level: number) => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    // Create nodes
    this.inputNode = audioContext.createGain();
    this.rectifier = audioContext.createWaveShaper();
    this.smoother = audioContext.createBiquadFilter();
    this.analyser = audioContext.createAnalyser();
    
    // Setup rectifier (full-wave rectification)
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      curve[i] = Math.abs((i - 128) / 128);
    }
    this.rectifier.curve = curve;
    this.rectifier.oversample = 'none';
    
    // Setup smoother (low-pass filter for envelope)
    this.smoother.type = 'lowpass';
    this.smoother.frequency.setValueAtTime(10, audioContext.currentTime); // 10Hz cutoff
    this.smoother.Q.setValueAtTime(0.707, audioContext.currentTime);
    
    // Setup analyser
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    
    // Connect the chain
    this.inputNode.connect(this.rectifier);
    this.rectifier.connect(this.smoother);
    this.smoother.connect(this.analyser);
    
    // Start monitoring
    this.startMonitoring();
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  private startMonitoring(): void {
    const monitor = () => {
      if (!this.onLevelChange) return;
      
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(dataArray);
      
      // Calculate envelope level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      
      const rms = Math.sqrt(sum / dataArray.length);
      const scaledLevel = rms * this.sensitivity;
      
      this.onLevelChange(scaledLevel);
    };

    this.updateInterval = window.setInterval(monitor, 10); // 100Hz update rate
  }

  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.inputNode.disconnect();
    this.rectifier.disconnect();
    this.smoother.disconnect();
    this.analyser.disconnect();
  }
}

export default SidechainDucker;