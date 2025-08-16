import { StemRole } from './types';

export interface StemAnalysisResult {
  stemId: string;
  detectedRole: StemRole;
  confidence: number;
  features: AudioFeatures;
  reasoning: string;
}

export interface AudioFeatures {
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
  mfcc: number[];
  chromaFeatures: number[];
  tempoPeaks: number[];
  dynamicRange: number;
  fundamentalFreq: number;
  harmonicRatio: number;
  percussiveRatio: number;
  energyDistribution: {
    subBass: number;    // 20-60 Hz
    bass: number;       // 60-250 Hz
    lowMid: number;     // 250-500 Hz
    mid: number;        // 500-2000 Hz
    highMid: number;    // 2000-4000 Hz
    presence: number;   // 4000-6000 Hz
    brilliance: number; // 6000+ Hz
  };
}

export class StemAnalyzer {
  private audioContext: AudioContext;
  private analyzerNode: AnalyserNode;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.analyzerNode = audioContext.createAnalyser();
    this.analyzerNode.fftSize = 4096;
    this.analyzerNode.smoothingTimeConstant = 0.3;
  }

  async analyzeStems(audioBuffers: { id: string; buffer: AudioBuffer }[]): Promise<StemAnalysisResult[]> {
    const results: StemAnalysisResult[] = [];

    for (const stem of audioBuffers) {
      try {
        const features = await this.extractAudioFeatures(stem.buffer);
        const role = this.detectRole(features);
        const confidence = this.calculateConfidence(features, role);
        const reasoning = this.generateReasoning(features, role);

        results.push({
          stemId: stem.id,
          detectedRole: role,
          confidence,
          features,
          reasoning
        });
      } catch (error) {
        console.error(`Failed to analyze stem ${stem.id}:`, error);
        // Fallback to generic role
        results.push({
          stemId: stem.id,
          detectedRole: StemRole.OTHER,
          confidence: 0.1,
          features: this.getDefaultFeatures(),
          reasoning: 'Analysis failed, assigned generic role'
        });
      }
    }

    return results;
  }

  private async extractAudioFeatures(buffer: AudioBuffer): Promise<AudioFeatures> {
    // Create offline context for analysis
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    // Set up analysis chain
    const source = offlineContext.createBufferSource();
    const analyzer = offlineContext.createAnalyser();
    
    analyzer.fftSize = 4096;
    analyzer.smoothingTimeConstant = 0;
    
    source.buffer = buffer;
    source.connect(analyzer);
    analyzer.connect(offlineContext.destination);

    // Extract time domain and frequency domain data
    const timeData = new Float32Array(analyzer.fftSize);
    const freqData = new Float32Array(analyzer.frequencyBinCount);
    
    // Analyze multiple windows across the audio
    const windowCount = Math.min(10, Math.floor(buffer.duration * 2)); // 2 windows per second
    const windowSize = Math.floor(buffer.length / windowCount);
    
    let spectralCentroid = 0;
    let spectralRolloff = 0;
    let zeroCrossingRate = 0;
    let fundamentalFreq = 0;
    
    const energyDistribution = {
      subBass: 0, bass: 0, lowMid: 0, mid: 0, 
      highMid: 0, presence: 0, brilliance: 0
    };

    // Analyze each window
    for (let w = 0; w < windowCount; w++) {
      const startSample = w * windowSize;
      const endSample = Math.min(startSample + windowSize, buffer.length);
      
      // Extract window data
      const windowData = buffer.getChannelData(0).slice(startSample, endSample);
      
      // Calculate features for this window
      spectralCentroid += this.calculateSpectralCentroid(windowData, buffer.sampleRate);
      spectralRolloff += this.calculateSpectralRolloff(windowData, buffer.sampleRate);
      zeroCrossingRate += this.calculateZeroCrossingRate(windowData);
      fundamentalFreq += this.estimateFundamentalFreq(windowData, buffer.sampleRate);
      
      // Energy distribution
      const windowEnergy = this.calculateEnergyDistribution(windowData, buffer.sampleRate);
      energyDistribution.subBass += windowEnergy.subBass;
      energyDistribution.bass += windowEnergy.bass;
      energyDistribution.lowMid += windowEnergy.lowMid;
      energyDistribution.mid += windowEnergy.mid;
      energyDistribution.highMid += windowEnergy.highMid;
      energyDistribution.presence += windowEnergy.presence;
      energyDistribution.brilliance += windowEnergy.brilliance;
    }

    // Average the results
    spectralCentroid /= windowCount;
    spectralRolloff /= windowCount;
    zeroCrossingRate /= windowCount;
    fundamentalFreq /= windowCount;
    
    Object.keys(energyDistribution).forEach(key => {
      energyDistribution[key as keyof typeof energyDistribution] /= windowCount;
    });

    // Calculate additional features
    const dynamicRange = this.calculateDynamicRange(buffer);
    const harmonicRatio = this.calculateHarmonicRatio(buffer);
    const percussiveRatio = this.calculatePercussiveRatio(buffer);
    const mfcc = this.calculateMFCC(buffer);
    const chromaFeatures = this.calculateChromaFeatures(buffer);
    const tempoPeaks = this.detectTempoPeaks(buffer);

    return {
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      mfcc,
      chromaFeatures,
      tempoPeaks,
      dynamicRange,
      fundamentalFreq,
      harmonicRatio,
      percussiveRatio,
      energyDistribution
    };
  }

  private detectRole(features: AudioFeatures): StemRole {
    const { energyDistribution, spectralCentroid, dynamicRange, percussiveRatio, fundamentalFreq } = features;
    
    // Rule-based classification with weighted scoring
    const scores = {
      [StemRole.KICK]: 0,
      [StemRole.SNARE]: 0,
      [StemRole.HIHAT]: 0,
      [StemRole.BASS]: 0,
      [StemRole.VOCAL]: 0,
      [StemRole.LEAD]: 0,
      [StemRole.PAD]: 0,
      [StemRole.DRUMS]: 0,
      [StemRole.PERCUSSION]: 0,
      [StemRole.OTHER]: 0.1 // Default baseline
    };

    // KICK: Heavy sub-bass, low spectral centroid, high percussive ratio
    if (energyDistribution.subBass > 0.3 && energyDistribution.bass > 0.4) {
      scores[StemRole.KICK] += 0.6;
    }
    if (spectralCentroid < 200 && percussiveRatio > 0.7) {
      scores[StemRole.KICK] += 0.4;
    }
    if (fundamentalFreq >= 40 && fundamentalFreq <= 80) {
      scores[StemRole.KICK] += 0.3;
    }

    // SNARE: Mid-range energy, high percussive ratio, specific frequency content
    if (energyDistribution.lowMid > 0.3 && energyDistribution.presence > 0.3) {
      scores[StemRole.SNARE] += 0.5;
    }
    if (spectralCentroid >= 200 && spectralCentroid <= 1000 && percussiveRatio > 0.6) {
      scores[StemRole.SNARE] += 0.4;
    }
    if (dynamicRange > 20) {
      scores[StemRole.SNARE] += 0.2;
    }

    // HIHAT: High-frequency dominant, very percussive
    if (energyDistribution.brilliance > 0.4 && energyDistribution.presence > 0.3) {
      scores[StemRole.HIHAT] += 0.6;
    }
    if (spectralCentroid > 3000 && percussiveRatio > 0.8) {
      scores[StemRole.HIHAT] += 0.4;
    }

    // BASS: Low-frequency dominant, sustained
    if (energyDistribution.bass > 0.5 && energyDistribution.subBass > 0.2) {
      scores[StemRole.BASS] += 0.6;
    }
    if (fundamentalFreq >= 40 && fundamentalFreq <= 200 && percussiveRatio < 0.4) {
      scores[StemRole.BASS] += 0.4;
    }
    if (spectralCentroid < 300) {
      scores[StemRole.BASS] += 0.3;
    }

    // VOCAL: Mid-high frequency, specific formant structure
    if (energyDistribution.mid > 0.3 && energyDistribution.highMid > 0.3) {
      scores[StemRole.VOCAL] += 0.5;
    }
    if (spectralCentroid >= 500 && spectralCentroid <= 2000) {
      scores[StemRole.VOCAL] += 0.4;
    }
    if (this.hasVocalFormants(features)) {
      scores[StemRole.VOCAL] += 0.4;
    }

    // LEAD: Broad frequency range, moderate harmonic content
    if (energyDistribution.mid > 0.25 && energyDistribution.highMid > 0.25) {
      scores[StemRole.LEAD] += 0.4;
    }
    if (spectralCentroid >= 400 && spectralCentroid <= 3000) {
      scores[StemRole.LEAD] += 0.3;
    }
    if (features.harmonicRatio > 0.6) {
      scores[StemRole.LEAD] += 0.3;
    }

    // PAD: Sustained, full frequency spectrum, low percussive ratio
    if (percussiveRatio < 0.2 && dynamicRange < 10) {
      scores[StemRole.PAD] += 0.5;
    }
    if (this.isFullSpectrum(energyDistribution)) {
      scores[StemRole.PAD] += 0.4;
    }

    // DRUMS: Mixed percussive elements
    if (percussiveRatio > 0.6 && dynamicRange > 15) {
      scores[StemRole.DRUMS] += 0.4;
    }
    if (this.hasMultiplePercussiveElements(features)) {
      scores[StemRole.DRUMS] += 0.5;
    }

    // Find highest scoring role
    let maxScore = 0;
    let detectedRole = StemRole.OTHER;
    
    Object.entries(scores).forEach(([role, score]) => {
      if (score > maxScore) {
        maxScore = score;
        detectedRole = role as StemRole;
      }
    });

    return detectedRole;
  }

  private calculateConfidence(features: AudioFeatures, role: StemRole): number {
    // Calculate confidence based on how well features match the detected role
    let confidence = 0.5; // Base confidence
    
    const { energyDistribution, spectralCentroid, percussiveRatio, dynamicRange } = features;
    
    switch (role) {
      case StemRole.KICK:
        if (energyDistribution.subBass > 0.4) confidence += 0.3;
        if (spectralCentroid < 150) confidence += 0.2;
        break;
        
      case StemRole.SNARE:
        if (energyDistribution.lowMid > 0.3 && energyDistribution.presence > 0.2) confidence += 0.3;
        if (percussiveRatio > 0.7) confidence += 0.2;
        break;
        
      case StemRole.BASS:
        if (energyDistribution.bass > 0.5) confidence += 0.3;
        if (spectralCentroid < 250) confidence += 0.2;
        break;
        
      case StemRole.VOCAL:
        if (this.hasVocalFormants(features)) confidence += 0.4;
        if (energyDistribution.mid > 0.3) confidence += 0.1;
        break;
        
      default:
        confidence = 0.3; // Lower confidence for generic assignments
    }
    
    return Math.min(1.0, Math.max(0.1, confidence));
  }

  private generateReasoning(features: AudioFeatures, role: StemRole): string {
    const { energyDistribution, spectralCentroid, percussiveRatio } = features;
    
    switch (role) {
      case StemRole.KICK:
        return `Strong sub-bass energy (${(energyDistribution.subBass * 100).toFixed(1)}%), low spectral centroid (${spectralCentroid.toFixed(0)}Hz), high percussive content (${(percussiveRatio * 100).toFixed(1)}%)`;
        
      case StemRole.SNARE:
        return `Mid-range energy with presence peaks, percussive transients (${(percussiveRatio * 100).toFixed(1)}%), spectral centroid at ${spectralCentroid.toFixed(0)}Hz`;
        
      case StemRole.BASS:
        return `Dominant bass frequencies (${(energyDistribution.bass * 100).toFixed(1)}%), low spectral centroid (${spectralCentroid.toFixed(0)}Hz), sustained character`;
        
      case StemRole.VOCAL:
        return `Mid-frequency dominance with vocal formant structure, spectral centroid at ${spectralCentroid.toFixed(0)}Hz, harmonic content`;
        
      case StemRole.HIHAT:
        return `High-frequency dominance (${(energyDistribution.brilliance * 100).toFixed(1)}%), very percussive (${(percussiveRatio * 100).toFixed(1)}%), spectral centroid > 3kHz`;
        
      default:
        return `Mixed frequency content, spectral centroid at ${spectralCentroid.toFixed(0)}Hz, moderate characteristics`;
    }
  }

  // Helper methods for feature extraction
  private calculateSpectralCentroid(data: Float32Array, sampleRate: number): number {
    const fft = this.performFFT(data);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const frequency = (i * sampleRate) / fft.length;
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(data: Float32Array, sampleRate: number): number {
    const fft = this.performFFT(data);
    const magnitudes = [];
    let totalMagnitude = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      magnitudes.push(magnitude);
      totalMagnitude += magnitude;
    }
    
    const threshold = totalMagnitude * 0.85; // 85% rolloff
    let runningSum = 0;
    
    for (let i = 0; i < magnitudes.length; i++) {
      runningSum += magnitudes[i];
      if (runningSum >= threshold) {
        return (i * sampleRate) / (magnitudes.length * 2);
      }
    }
    
    return sampleRate / 2; // Nyquist frequency
  }

  private calculateZeroCrossingRate(data: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0) !== (data[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / data.length;
  }

  private estimateFundamentalFreq(data: Float32Array, sampleRate: number): number {
    // Simple autocorrelation-based pitch detection
    const minPeriod = Math.floor(sampleRate / 800); // 800 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min
    
    let bestPeriod = minPeriod;
    let maxCorrelation = 0;
    
    for (let period = minPeriod; period <= maxPeriod && period < data.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < data.length - period; i++) {
        correlation += data[i] * data[i + period];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return sampleRate / bestPeriod;
  }

  private calculateEnergyDistribution(data: Float32Array, sampleRate: number): AudioFeatures['energyDistribution'] {
    const fft = this.performFFT(data);
    const binSize = sampleRate / fft.length;
    
    const bands = {
      subBass: 0, bass: 0, lowMid: 0, mid: 0,
      highMid: 0, presence: 0, brilliance: 0
    };
    
    for (let i = 0; i < fft.length / 2; i++) {
      const frequency = i * binSize;
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      
      if (frequency < 60) bands.subBass += magnitude;
      else if (frequency < 250) bands.bass += magnitude;
      else if (frequency < 500) bands.lowMid += magnitude;
      else if (frequency < 2000) bands.mid += magnitude;
      else if (frequency < 4000) bands.highMid += magnitude;
      else if (frequency < 6000) bands.presence += magnitude;
      else bands.brilliance += magnitude;
    }
    
    // Normalize
    const total = Object.values(bands).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      Object.keys(bands).forEach(key => {
        bands[key as keyof typeof bands] /= total;
      });
    }
    
    return bands;
  }

  private calculateDynamicRange(buffer: AudioBuffer): number {
    const data = buffer.getChannelData(0);
    let min = Infinity, max = -Infinity;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    
    return 20 * Math.log10((max - min) || 0.001);
  }

  private calculateHarmonicRatio(buffer: AudioBuffer): number {
    // Simplified harmonic-to-noise ratio calculation
    const data = buffer.getChannelData(0);
    const windowSize = 1024;
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      const window = data.slice(i, i + windowSize);
      const fft = this.performFFT(window);
      
      // Calculate harmonic content (simplified)
      for (let j = 0; j < fft.length / 2; j += 2) {
        const magnitude = Math.sqrt(fft[j] ** 2 + fft[j + 1] ** 2);
        totalEnergy += magnitude;
        
        // Consider even harmonics as more harmonic
        if (j % 4 === 0 && j > 0) {
          harmonicEnergy += magnitude;
        }
      }
    }
    
    return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
  }

  private calculatePercussiveRatio(buffer: AudioBuffer): number {
    const data = buffer.getChannelData(0);
    const windowSize = 512;
    let percussiveEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < data.length - windowSize; i += windowSize / 2) {
      const window = data.slice(i, i + windowSize);
      
      // Calculate onset strength (simplified)
      let onsetStrength = 0;
      for (let j = 1; j < window.length; j++) {
        const diff = Math.abs(window[j] - window[j - 1]);
        onsetStrength += diff;
        totalEnergy += Math.abs(window[j]);
      }
      
      percussiveEnergy += onsetStrength;
    }
    
    return totalEnergy > 0 ? percussiveEnergy / totalEnergy : 0;
  }

  private calculateMFCC(buffer: AudioBuffer): number[] {
    // Simplified MFCC calculation (normally would use mel filter banks)
    const data = buffer.getChannelData(0);
    const windowSize = 1024;
    const numCoeffs = 13;
    const mfccs = new Array(numCoeffs).fill(0);
    
    // This is a very simplified version - real MFCC needs mel filter banks
    for (let i = 0; i < Math.min(5, Math.floor(data.length / windowSize)); i++) {
      const start = i * windowSize;
      const window = data.slice(start, start + windowSize);
      const fft = this.performFFT(window);
      
      // Extract spectral features as MFCC approximation
      for (let j = 0; j < numCoeffs && j < fft.length / 4; j++) {
        const magnitude = Math.sqrt(fft[j * 2] ** 2 + fft[j * 2 + 1] ** 2);
        mfccs[j] += Math.log(magnitude + 1e-10);
      }
    }
    
    return mfccs.map(val => val / 5); // Average over windows
  }

  private calculateChromaFeatures(buffer: AudioBuffer): number[] {
    // Simplified chroma feature extraction
    const chromaBins = 12; // 12 semitones
    const chroma = new Array(chromaBins).fill(0);
    
    const data = buffer.getChannelData(0);
    const fft = this.performFFT(data.slice(0, Math.min(4096, data.length)));
    
    for (let i = 1; i < fft.length / 2; i++) {
      const frequency = (i * buffer.sampleRate) / fft.length;
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      
      // Map frequency to chroma bin (simplified)
      if (frequency > 80 && frequency < 2000) {
        const pitch = 12 * Math.log2(frequency / 440) + 69; // MIDI note number
        const chromaBin = Math.round(pitch) % 12;
        if (chromaBin >= 0 && chromaBin < 12) {
          chroma[chromaBin] += magnitude;
        }
      }
    }
    
    // Normalize
    const total = chroma.reduce((sum, val) => sum + val, 0);
    return total > 0 ? chroma.map(val => val / total) : chroma;
  }

  private detectTempoPeaks(buffer: AudioBuffer): number[] {
    // Simple tempo detection using onset detection
    const data = buffer.getChannelData(0);
    const hopSize = 512;
    const onsets: number[] = [];
    
    for (let i = hopSize; i < data.length - hopSize; i += hopSize) {
      const current = this.calculateSpectralFlux(data.slice(i - hopSize, i), data.slice(i, i + hopSize));
      if (current > 0.1) { // Threshold for onset detection
        onsets.push(i / buffer.sampleRate);
      }
    }
    
    return onsets;
  }

  private calculateSpectralFlux(prev: Float32Array, current: Float32Array): number {
    let flux = 0;
    const minLength = Math.min(prev.length, current.length);
    
    for (let i = 0; i < minLength; i++) {
      const diff = current[i] - prev[i];
      if (diff > 0) flux += diff;
    }
    
    return flux / minLength;
  }

  private hasVocalFormants(features: AudioFeatures): boolean {
    // Check for typical vocal formant frequencies
    const { energyDistribution } = features;
    return energyDistribution.mid > 0.25 && 
           energyDistribution.highMid > 0.2 && 
           energyDistribution.presence > 0.15;
  }

  private isFullSpectrum(energyDistribution: AudioFeatures['energyDistribution']): boolean {
    // Check if energy is distributed across all frequency bands
    const bands = Object.values(energyDistribution);
    const nonZeroBands = bands.filter(val => val > 0.05).length;
    return nonZeroBands >= 5; // At least 5 bands have significant energy
  }

  private hasMultiplePercussiveElements(features: AudioFeatures): boolean {
    // Check for multiple percussive frequency ranges
    const { energyDistribution, tempoPeaks } = features;
    const percussiveBands = [
      energyDistribution.bass > 0.2,      // Kick range
      energyDistribution.lowMid > 0.2,    // Snare range
      energyDistribution.brilliance > 0.2 // Hihat range
    ].filter(Boolean).length;
    
    return percussiveBands >= 2 && tempoPeaks.length > 3;
  }

  private performFFT(data: Float32Array): Float32Array {
    // Simple FFT implementation (in real application, use a proper FFT library)
    const N = data.length;
    const result = new Float32Array(N * 2);
    
    // This is a placeholder - use a real FFT library like FFT.js
    for (let i = 0; i < N; i++) {
      result[i * 2] = data[i]; // Real part
      result[i * 2 + 1] = 0;   // Imaginary part
    }
    
    return result;
  }

  private getDefaultFeatures(): AudioFeatures {
    return {
      spectralCentroid: 1000,
      spectralRolloff: 5000,
      zeroCrossingRate: 0.1,
      mfcc: new Array(13).fill(0),
      chromaFeatures: new Array(12).fill(0.083), // Equal distribution
      tempoPeaks: [],
      dynamicRange: 20,
      fundamentalFreq: 440,
      harmonicRatio: 0.5,
      percussiveRatio: 0.3,
      energyDistribution: {
        subBass: 0.1, bass: 0.15, lowMid: 0.15, mid: 0.25,
        highMid: 0.15, presence: 0.1, brilliance: 0.1
      }
    };
  }
}

export default StemAnalyzer;