import { MacroProcessingResult, EQBand, CompressionSettings, SaturationSettings, StereoWidthSettings, LimiterSettings } from './macroProcessor';

export class AudioEffectsEngine {
  private audioContext: AudioContext;
  private effectChains: Map<string, EffectChain> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Create or update an effect chain for a stem
   */
  createEffectChain(stemId: string, processingResult: MacroProcessingResult): EffectChain {
    const existingChain = this.effectChains.get(stemId);
    if (existingChain) {
      existingChain.dispose();
    }

    const chain = new EffectChain(this.audioContext, processingResult);
    this.effectChains.set(stemId, chain);
    return chain;
  }

  /**
   * Get the effect chain for a stem
   */
  getEffectChain(stemId: string): EffectChain | undefined {
    return this.effectChains.get(stemId);
  }

  /**
   * Remove an effect chain
   */
  removeEffectChain(stemId: string): void {
    const chain = this.effectChains.get(stemId);
    if (chain) {
      chain.dispose();
      this.effectChains.delete(stemId);
    }
  }

  /**
   * Dispose of all effect chains
   */
  dispose(): void {
    this.effectChains.forEach(chain => chain.dispose());
    this.effectChains.clear();
  }
}

export class EffectChain {
  private audioContext: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private eqNodes: BiquadFilterNode[] = [];
  private compressor: DynamicsCompressorNode;
  private saturationNode: WaveShaperNode;
  private stereoSplitter: ChannelSplitterNode;
  private stereoMerger: ChannelMergerNode;
  private midGain: GainNode;
  private sideGain: GainNode;
  private limiter: DynamicsCompressorNode;
  private gainCompensation: GainNode;

  constructor(audioContext: AudioContext, processingResult: MacroProcessingResult) {
    this.audioContext = audioContext;
    
    // Create nodes
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.compressor = audioContext.createDynamicsCompressor();
    this.saturationNode = audioContext.createWaveShaper();
    this.stereoSplitter = audioContext.createChannelSplitter(2);
    this.stereoMerger = audioContext.createChannelMerger(2);
    this.midGain = audioContext.createGain();
    this.sideGain = audioContext.createGain();
    this.limiter = audioContext.createDynamicsCompressor();
    this.gainCompensation = audioContext.createGain();

    // Build effect chain
    this.buildChain(processingResult);
  }

  private buildChain(processingResult: MacroProcessingResult): void {
    let currentNode: AudioNode = this.inputNode;

    // 1. HPF → EQ chain
    currentNode = this.buildEQChain(currentNode, processingResult.eqCurve);

    // 2. Compression
    if (processingResult.compression.enabled) {
      currentNode = this.buildCompressor(currentNode, processingResult.compression);
    }

    // 3. Saturation
    if (processingResult.saturation.enabled) {
      currentNode = this.buildSaturation(currentNode, processingResult.saturation);
    }

    // 4. Stereo Width processing
    if (processingResult.stereoWidth.enabled) {
      currentNode = this.buildStereoWidth(currentNode, processingResult.stereoWidth);
    }

    // 5. Gain compensation
    currentNode.connect(this.gainCompensation);
    currentNode = this.gainCompensation;

    // 6. Limiter (always on for safety)
    currentNode = this.buildLimiter(currentNode, processingResult.limiterSettings);

    // Final output
    currentNode.connect(this.outputNode);
  }

  private buildEQChain(inputNode: AudioNode, eqCurve: EQBand[]): AudioNode {
    let currentNode = inputNode;

    // Clear existing EQ nodes
    this.eqNodes.forEach(node => node.disconnect());
    this.eqNodes = [];

    eqCurve.forEach(band => {
      if (band.enabled) {
        const eqNode = this.audioContext.createBiquadFilter();
        
        // Set filter type
        switch (band.type) {
          case 'highpass':
            eqNode.type = 'highpass';
            break;
          case 'lowpass':
            eqNode.type = 'lowpass';
            break;
          case 'highshelf':
            eqNode.type = 'highshelf';
            break;
          case 'lowshelf':
            eqNode.type = 'lowshelf';
            break;
          case 'bell':
          default:
            eqNode.type = 'peaking';
            break;
        }

        // Set parameters
        eqNode.frequency.setValueAtTime(band.frequency, this.audioContext.currentTime);
        eqNode.gain.setValueAtTime(band.gain, this.audioContext.currentTime);
        eqNode.Q.setValueAtTime(band.q, this.audioContext.currentTime);

        // Connect in chain
        currentNode.connect(eqNode);
        currentNode = eqNode;
        this.eqNodes.push(eqNode);
      }
    });

    return currentNode;
  }

  private buildCompressor(inputNode: AudioNode, settings: CompressionSettings): AudioNode {
    inputNode.connect(this.compressor);

    // Set compressor parameters
    this.compressor.threshold.setValueAtTime(settings.threshold, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(settings.ratio, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(settings.attack / 1000, this.audioContext.currentTime); // Convert ms to seconds
    this.compressor.release.setValueAtTime(settings.release / 1000, this.audioContext.currentTime);

    // Makeup gain
    if (settings.makeupGain !== 0) {
      const makeupGain = this.audioContext.createGain();
      makeupGain.gain.setValueAtTime(
        this.dbToLinear(settings.makeupGain), 
        this.audioContext.currentTime
      );
      this.compressor.connect(makeupGain);
      return makeupGain;
    }

    return this.compressor;
  }

  private buildSaturation(inputNode: AudioNode, settings: SaturationSettings): AudioNode {
    inputNode.connect(this.saturationNode);

    // Create saturation curve based on character and drive
    const curve = this.createSaturationCurve(settings.drive, settings.character);
    this.saturationNode.curve = new Float32Array(curve);
    this.saturationNode.oversample = '4x';

    // Mix control (dry/wet)
    if (settings.mix < 100) {
      const wetGain = this.audioContext.createGain();
      const dryGain = this.audioContext.createGain();
      const mixer = this.audioContext.createGain();

      wetGain.gain.setValueAtTime(settings.mix / 100, this.audioContext.currentTime);
      dryGain.gain.setValueAtTime((100 - settings.mix) / 100, this.audioContext.currentTime);

      // Wet path
      this.saturationNode.connect(wetGain);
      wetGain.connect(mixer);

      // Dry path
      inputNode.connect(dryGain);
      dryGain.connect(mixer);

      return mixer;
    }

    return this.saturationNode;
  }

  private buildStereoWidth(inputNode: AudioNode, settings: StereoWidthSettings): AudioNode {
    inputNode.connect(this.stereoSplitter);

    // Create Mid/Side processing
    const leftGain = this.audioContext.createGain();
    const rightGain = this.audioContext.createGain();
    
    // Split to L/R
    this.stereoSplitter.connect(leftGain, 0);
    this.stereoSplitter.connect(rightGain, 1);

    // Create Mid and Side signals
    const midLeft = this.audioContext.createGain();
    const midRight = this.audioContext.createGain();
    const sideLeft = this.audioContext.createGain();
    const sideRight = this.audioContext.createGain();

    // Mid = (L + R) / 2
    midLeft.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    midRight.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    
    // Side = (L - R) / 2
    sideLeft.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    sideRight.gain.setValueAtTime(-0.5, this.audioContext.currentTime);

    leftGain.connect(midLeft);
    rightGain.connect(midLeft);
    leftGain.connect(sideLeft);
    rightGain.connect(sideRight);

    midLeft.connect(this.midGain);
    sideLeft.connect(this.sideGain);
    sideRight.connect(this.sideGain);

    // Apply width control to side channel
    const widthMultiplier = settings.width / 100;
    this.sideGain.gain.setValueAtTime(widthMultiplier, this.audioContext.currentTime);

    // Convert back to L/R
    const outLeft = this.audioContext.createGain();
    const outRight = this.audioContext.createGain();

    // L = Mid + Side, R = Mid - Side
    this.midGain.connect(outLeft);
    this.midGain.connect(outRight);
    this.sideGain.connect(outLeft);
    
    const sideInvert = this.audioContext.createGain();
    sideInvert.gain.setValueAtTime(-1, this.audioContext.currentTime);
    this.sideGain.connect(sideInvert);
    sideInvert.connect(outRight);

    // Merge back to stereo
    outLeft.connect(this.stereoMerger, 0, 0);
    outRight.connect(this.stereoMerger, 0, 1);

    return this.stereoMerger;
  }

  private buildLimiter(inputNode: AudioNode, settings: LimiterSettings): AudioNode {
    inputNode.connect(this.limiter);

    // Configure as limiter (high ratio, fast attack)
    this.limiter.threshold.setValueAtTime(settings.ceiling, this.audioContext.currentTime);
    this.limiter.ratio.setValueAtTime(20, this.audioContext.currentTime); // High ratio for limiting
    this.limiter.attack.setValueAtTime(0.001, this.audioContext.currentTime); // Very fast attack
    this.limiter.release.setValueAtTime(settings.release / 1000, this.audioContext.currentTime);

    return this.limiter;
  }

  private createSaturationCurve(drive: number, character: string): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      let y = x;

      switch (character) {
        case 'tube':
          // Tube-like asymmetric soft clipping
          y = Math.sign(x) * Math.tanh(Math.abs(x) * (1 + drive * 0.5));
          break;
        case 'tape':
          // Tape-like soft saturation
          y = Math.tanh(x * (1 + drive * 0.3));
          break;
        case 'transistor':
          // Transistor-like harder clipping
          y = Math.sign(x) * Math.min(Math.abs(x) * (1 + drive * 0.8), 0.95);
          break;
        default:
          y = x;
      }

      curve[i] = y;
    }

    return curve;
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  /**
   * Update gain compensation
   */
  setGainCompensation(dbGain: number): void {
    this.gainCompensation.gain.setValueAtTime(
      this.dbToLinear(dbGain),
      this.audioContext.currentTime
    );
  }

  /**
   * Get input node for connecting sources
   */
  getInputNode(): AudioNode {
    return this.inputNode;
  }

  /**
   * Get output node for connecting to destination
   */
  getOutputNode(): AudioNode {
    return this.outputNode;
  }

  /**
   * Dispose of all nodes
   */
  dispose(): void {
    this.eqNodes.forEach(node => {
      node.disconnect();
    });
    
    [
      this.inputNode,
      this.outputNode,
      this.compressor,
      this.saturationNode,
      this.stereoSplitter,
      this.stereoMerger,
      this.midGain,
      this.sideGain,
      this.limiter,
      this.gainCompensation
    ].forEach(node => {
      node.disconnect();
    });
  }
}

export default AudioEffectsEngine;