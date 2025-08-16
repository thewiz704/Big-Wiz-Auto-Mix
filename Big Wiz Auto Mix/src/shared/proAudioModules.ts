export class TransientShaper {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private envelopeFollower: EnvelopeFollower;
  private attackProcessor: AttackProcessor;
  private sustainProcessor: SustainProcessor;
  private analyser: AnalyserNode;
  
  private parameters = {
    attack: 0,      // -100 to +100 (percentage change)
    sustain: 0,     // -100 to +100 (percentage change)
    frequency: 1000, // Focus frequency for detection
    sensitivity: 50, // 0-100 detection sensitivity
    lookahead: 5,   // ms lookahead for zero-latency feel
    mix: 100        // 0-100 wet/dry mix
  };

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    // Create audio graph
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.analyser = audioContext.createAnalyser();
    
    // Setup analysis
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.3;
    
    this.envelopeFollower = new EnvelopeFollower(audioContext);
    this.attackProcessor = new AttackProcessor(audioContext);
    this.sustainProcessor = new SustainProcessor(audioContext);
    
    this.connectNodes();
    this.setupProcessing();
  }

  private connectNodes(): void {
    // Main signal path
    this.inputNode.connect(this.outputNode);
    
    // Analysis path
    this.inputNode.connect(this.analyser);
    this.inputNode.connect(this.envelopeFollower.getInputNode());
    
    // Processing path
    this.inputNode.connect(this.attackProcessor.getInputNode());
    this.inputNode.connect(this.sustainProcessor.getInputNode());
    
    this.attackProcessor.connect(this.outputNode);
    this.sustainProcessor.connect(this.outputNode);
  }

  private setupProcessing(): void {
    this.envelopeFollower.onTransientDetected = (strength: number, type: 'attack' | 'sustain') => {
      if (type === 'attack' && this.parameters.attack !== 0) {
        this.attackProcessor.processTransient(strength, this.parameters.attack);
      }
      
      if (type === 'sustain' && this.parameters.sustain !== 0) {
        this.sustainProcessor.processTransient(strength, this.parameters.sustain);
      }
    };
  }

  setParameter(param: keyof typeof this.parameters, value: number): void {
    this.parameters[param] = value;
    
    switch (param) {
      case 'frequency':
        this.envelopeFollower.setFocusFrequency(value);
        break;
      case 'sensitivity':
        this.envelopeFollower.setSensitivity(value / 100);
        break;
      case 'lookahead':
        this.attackProcessor.setLookahead(value);
        this.sustainProcessor.setLookahead(value);
        break;
      case 'mix':
        this.updateMix();
        break;
    }
  }

  private updateMix(): void {
    const wetGain = this.parameters.mix / 100;
    const dryGain = 1 - wetGain;
    
    // This would adjust the mix between processed and dry signal
    this.attackProcessor.setWetLevel(wetGain);
    this.sustainProcessor.setWetLevel(wetGain);
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  getOutputNode(): AudioNode {
    return this.outputNode;
  }

  getAnalysisData(): {
    transientActivity: number;
    attackGainReduction: number;
    sustainGainReduction: number;
    frequency: number;
  } {
    return {
      transientActivity: this.envelopeFollower.getActivity(),
      attackGainReduction: this.attackProcessor.getGainReduction(),
      sustainGainReduction: this.sustainProcessor.getGainReduction(),
      frequency: this.parameters.frequency
    };
  }

  dispose(): void {
    this.envelopeFollower.dispose();
    this.attackProcessor.dispose();
    this.sustainProcessor.dispose();
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.analyser.disconnect();
  }
}

export class HarmonicExciter {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  private lowBandProcessor: HarmonicBandProcessor;
  private midBandProcessor: HarmonicBandProcessor;
  private highBandProcessor: HarmonicBandProcessor;
  
  private parameters = {
    lowDrive: 0,        // 0-100 low frequency drive
    lowHarmonics: 'even', // 'even', 'odd', 'both'
    midDrive: 0,        // 0-100 mid frequency drive  
    midHarmonics: 'odd', // 'even', 'odd', 'both'
    highDrive: 0,       // 0-100 high frequency drive
    highHarmonics: 'even', // 'even', 'odd', 'both'
    lowFreq: 300,       // Low band cutoff
    highFreq: 3000,     // High band cutoff
    character: 'tube',  // 'tube', 'tape', 'transistor', 'digital'
    mix: 25             // 0-100 wet/dry mix
  };

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Create three-band harmonic processors
    this.lowBandProcessor = new HarmonicBandProcessor(audioContext, 'low');
    this.midBandProcessor = new HarmonicBandProcessor(audioContext, 'mid');
    this.highBandProcessor = new HarmonicBandProcessor(audioContext, 'high');
    
    this.connectNodes();
    this.setupCrossovers();
  }

  private connectNodes(): void {
    // Split to stereo channels for processing
    this.inputNode.connect(this.splitter);
    
    // Process each band
    this.splitter.connect(this.lowBandProcessor.getInputNode(), 0);
    this.splitter.connect(this.lowBandProcessor.getInputNode(), 1);
    
    this.splitter.connect(this.midBandProcessor.getInputNode(), 0);
    this.splitter.connect(this.midBandProcessor.getInputNode(), 1);
    
    this.splitter.connect(this.highBandProcessor.getInputNode(), 0);
    this.splitter.connect(this.highBandProcessor.getInputNode(), 1);
    
    // Recombine processed bands
    this.lowBandProcessor.connect(this.merger, 0, 0);
    this.lowBandProcessor.connect(this.merger, 0, 1);
    
    this.midBandProcessor.connect(this.merger, 0, 0);
    this.midBandProcessor.connect(this.merger, 0, 1);
    
    this.highBandProcessor.connect(this.merger, 0, 0);
    this.highBandProcessor.connect(this.merger, 0, 1);
    
    this.merger.connect(this.outputNode);
  }

  private setupCrossovers(): void {
    // Setup frequency crossovers for three bands
    this.lowBandProcessor.setCrossover('lowpass', this.parameters.lowFreq);
    this.midBandProcessor.setCrossover('bandpass', this.parameters.lowFreq, this.parameters.highFreq);
    this.highBandProcessor.setCrossover('highpass', this.parameters.highFreq);
  }

  setParameter(param: keyof typeof this.parameters, value: number | string): void {
    (this.parameters as any)[param] = value;
    
    switch (param) {
      case 'lowDrive':
        this.lowBandProcessor.setDrive(value as number);
        break;
      case 'lowHarmonics':
        this.lowBandProcessor.setHarmonicType(value as string);
        break;
      case 'midDrive':
        this.midBandProcessor.setDrive(value as number);
        break;
      case 'midHarmonics':
        this.midBandProcessor.setHarmonicType(value as string);
        break;
      case 'highDrive':
        this.highBandProcessor.setDrive(value as number);
        break;
      case 'highHarmonics':
        this.highBandProcessor.setHarmonicType(value as string);
        break;
      case 'lowFreq':
      case 'highFreq':
        this.setupCrossovers();
        break;
      case 'character':
        this.setCharacter(value as string);
        break;
      case 'mix':
        this.updateMix();
        break;
    }
  }

  private setCharacter(character: string): void {
    // Set the harmonic character across all bands
    this.lowBandProcessor.setCharacter(character);
    this.midBandProcessor.setCharacter(character);
    this.highBandProcessor.setCharacter(character);
  }

  private updateMix(): void {
    const wetGain = this.parameters.mix / 100;
    this.lowBandProcessor.setMix(wetGain);
    this.midBandProcessor.setMix(wetGain);
    this.highBandProcessor.setMix(wetGain);
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  getOutputNode(): AudioNode {
    return this.outputNode;
  }

  getAnalysisData(): {
    lowHarmonics: number;
    midHarmonics: number;
    highHarmonics: number;
    totalHarmonicContent: number;
  } {
    const lowHarmonics = this.lowBandProcessor.getHarmonicContent();
    const midHarmonics = this.midBandProcessor.getHarmonicContent();
    const highHarmonics = this.highBandProcessor.getHarmonicContent();
    
    return {
      lowHarmonics,
      midHarmonics,
      highHarmonics,
      totalHarmonicContent: (lowHarmonics + midHarmonics + highHarmonics) / 3
    };
  }

  dispose(): void {
    this.lowBandProcessor.dispose();
    this.midBandProcessor.dispose();
    this.highBandProcessor.dispose();
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
  }
}

// Supporting classes
class EnvelopeFollower {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private bandpassFilter: BiquadFilterNode;
  private rectifier: WaveShaperNode;
  private smoother: BiquadFilterNode;
  private analyser: AnalyserNode;
  private sensitivity: number = 0.5;
  private focusFreq: number = 1000;
  private activity: number = 0;
  
  public onTransientDetected: ((strength: number, type: 'attack' | 'sustain') => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    this.inputNode = audioContext.createGain();
    this.bandpassFilter = audioContext.createBiquadFilter();
    this.rectifier = audioContext.createWaveShaper();
    this.smoother = audioContext.createBiquadFilter();
    this.analyser = audioContext.createAnalyser();
    
    this.setupNodes();
    this.startDetection();
  }

  private setupNodes(): void {
    // Bandpass filter for frequency focus
    this.bandpassFilter.type = 'bandpass';
    this.bandpassFilter.frequency.setValueAtTime(this.focusFreq, this.audioContext.currentTime);
    this.bandpassFilter.Q.setValueAtTime(1.0, this.audioContext.currentTime);
    
    // Full-wave rectifier
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      curve[i] = Math.abs((i - 128) / 128);
    }
    this.rectifier.curve = curve;
    
    // Smoothing filter
    this.smoother.type = 'lowpass';
    this.smoother.frequency.setValueAtTime(20, this.audioContext.currentTime);
    
    // Connect chain
    this.inputNode.connect(this.bandpassFilter);
    this.bandpassFilter.connect(this.rectifier);
    this.rectifier.connect(this.smoother);
    this.smoother.connect(this.analyser);
  }

  private startDetection(): void {
    const detectTransients = () => {
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      this.analyser.getFloatTimeDomainData(dataArray);
      
      // Simple transient detection algorithm
      let rms = 0;
      for (let i = 0; i < bufferLength; i++) {
        rms += dataArray[i] * dataArray[i];
      }
      rms = Math.sqrt(rms / bufferLength);
      
      // Update activity level
      this.activity = rms * this.sensitivity;
      
      // Detect transients (simplified)
      if (rms > this.sensitivity * 0.1) {
        if (this.onTransientDetected) {
          // Determine if it's an attack or sustain based on envelope shape
          const isAttack = this.detectAttack(dataArray);
          this.onTransientDetected(rms, isAttack ? 'attack' : 'sustain');
        }
      }
      
      requestAnimationFrame(detectTransients);
    };
    
    detectTransients();
  }

  private detectAttack(data: Float32Array): boolean {
    // Simple attack detection: look for rapid rise in amplitude
    let risingEdges = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[i - 1] * 1.1) {
        risingEdges++;
      }
    }
    return risingEdges > data.length * 0.1; // If >10% of samples are rising edges
  }

  setFocusFrequency(freq: number): void {
    this.focusFreq = freq;
    this.bandpassFilter.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  getActivity(): number {
    return this.activity;
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  dispose(): void {
    this.inputNode.disconnect();
    this.bandpassFilter.disconnect();
    this.rectifier.disconnect();
    this.smoother.disconnect();
    this.analyser.disconnect();
  }
}

class AttackProcessor {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private delayNode: DelayNode;
  private gainNode: GainNode;
  private wetLevel: number = 1;
  private gainReduction: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.delayNode = audioContext.createDelay(0.1);
    this.gainNode = audioContext.createGain();
    
    // Connect nodes
    this.inputNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    this.gainNode.connect(this.outputNode);
  }

  processTransient(strength: number, attackSetting: number): void {
    // attackSetting: -100 to +100
    const now = this.audioContext.currentTime;
    const attackGain = 1 + (attackSetting / 100) * strength;
    
    this.gainNode.gain.setTargetAtTime(attackGain, now, 0.001);
    this.gainReduction = Math.abs(attackGain - 1) * 100;
    
    // Return to unity after transient
    this.gainNode.gain.setTargetAtTime(1, now + 0.05, 0.02);
  }

  setLookahead(ms: number): void {
    const seconds = Math.max(0, Math.min(ms / 1000, 0.1));
    this.delayNode.delayTime.setTargetAtTime(seconds, this.audioContext.currentTime, 0.01);
  }

  setWetLevel(level: number): void {
    this.wetLevel = level;
    this.outputNode.gain.setTargetAtTime(level, this.audioContext.currentTime, 0.01);
  }

  getGainReduction(): number {
    return this.gainReduction;
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.delayNode.disconnect();
    this.gainNode.disconnect();
  }
}

class SustainProcessor {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private gainNode: GainNode;
  private wetLevel: number = 1;
  private gainReduction: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.gainNode = audioContext.createGain();
    
    this.inputNode.connect(this.gainNode);
    this.gainNode.connect(this.outputNode);
  }

  processTransient(strength: number, sustainSetting: number): void {
    // sustainSetting: -100 to +100
    const now = this.audioContext.currentTime;
    const sustainGain = 1 + (sustainSetting / 100) * strength;
    
    // Apply sustain processing with longer time constant
    this.gainNode.gain.setTargetAtTime(sustainGain, now + 0.02, 0.1);
    this.gainReduction = Math.abs(sustainGain - 1) * 100;
    
    // Return to unity more slowly
    this.gainNode.gain.setTargetAtTime(1, now + 0.2, 0.1);
  }

  setLookahead(ms: number): void {
    // Sustain doesn't use lookahead
  }

  setWetLevel(level: number): void {
    this.wetLevel = level;
    this.outputNode.gain.setTargetAtTime(level, this.audioContext.currentTime, 0.01);
  }

  getGainReduction(): number {
    return this.gainReduction;
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.gainNode.disconnect();
  }
}

class HarmonicBandProcessor {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private crossoverFilter: BiquadFilterNode;
  private saturationNode: WaveShaperNode;
  private mixGain: GainNode;
  private harmonicContent: number = 0;

  constructor(audioContext: AudioContext, private band: 'low' | 'mid' | 'high') {
    this.audioContext = audioContext;
    
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.crossoverFilter = audioContext.createBiquadFilter();
    this.saturationNode = audioContext.createWaveShaper();
    this.mixGain = audioContext.createGain();
    
    this.connectNodes();
    this.setupSaturation();
  }

  private connectNodes(): void {
    this.inputNode.connect(this.crossoverFilter);
    this.crossoverFilter.connect(this.saturationNode);
    this.saturationNode.connect(this.mixGain);
    this.mixGain.connect(this.outputNode);
  }

  private setupSaturation(): void {
    // Default tube-style saturation curve
    this.setCharacter('tube');
  }

  setCrossover(type: 'lowpass' | 'highpass' | 'bandpass', freq1: number, freq2?: number): void {
    this.crossoverFilter.type = type;
    this.crossoverFilter.frequency.setValueAtTime(freq1, this.audioContext.currentTime);
    this.crossoverFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);
    
    // For bandpass, we'd need a second filter (simplified here)
  }

  setDrive(drive: number): void {
    // drive: 0-100
    const driveAmount = drive / 100;
    this.harmonicContent = driveAmount;
    
    // Update saturation curve based on drive
    this.updateSaturationCurve(driveAmount);
  }

  setHarmonicType(type: string): void {
    // Update curve based on harmonic type
    this.updateSaturationCurve(this.harmonicContent, type);
  }

  setCharacter(character: string): void {
    // Different saturation characteristics
    this.updateSaturationCurve(this.harmonicContent, undefined, character);
  }

  private updateSaturationCurve(drive: number, harmonicType?: string, character?: string): void {
    const samples = 256;
    const curve = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const x = (i - samples / 2) / (samples / 2); // -1 to 1
      
      let y = x;
      
      if (drive > 0) {
        switch (character) {
          case 'tube':
            y = Math.tanh(x * (1 + drive * 5)) * 0.8;
            break;
          case 'tape':
            y = x / (1 + Math.abs(x) * drive);
            break;
          case 'transistor':
            y = Math.sign(x) * Math.min(Math.abs(x * (1 + drive)), 1);
            break;
          case 'digital':
            y = Math.max(-1, Math.min(1, x * (1 + drive * 2)));
            break;
          default:
            y = Math.tanh(x * (1 + drive * 3));
        }
        
        // Adjust for harmonic type
        if (harmonicType === 'even') {
          y = y + Math.sin(x * Math.PI) * drive * 0.1;
        } else if (harmonicType === 'odd') {
          y = y + Math.sin(x * Math.PI * 2) * drive * 0.1;
        }
      }
      
      curve[i] = y;
    }
    
    this.saturationNode.curve = curve;
    this.saturationNode.oversample = drive > 0.5 ? '4x' : 'none';
  }

  setMix(wetLevel: number): void {
    this.mixGain.gain.setTargetAtTime(wetLevel, this.audioContext.currentTime, 0.01);
  }

  getHarmonicContent(): number {
    return this.harmonicContent;
  }

  getInputNode(): AudioNode {
    return this.inputNode;
  }

  connect(destination: AudioNode, output?: number, input?: number): void {
    this.outputNode.connect(destination, output, input);
  }

  dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.crossoverFilter.disconnect();
    this.saturationNode.disconnect();
    this.mixGain.disconnect();
  }
}

export { EnvelopeFollower, AttackProcessor, SustainProcessor, HarmonicBandProcessor };