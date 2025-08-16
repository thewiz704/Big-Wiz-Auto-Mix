export class AudioManager {
  private audioContext: AudioContext;
  private gainNodes: Map<string, GainNode> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private masterGain: GainNode;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private stemStates: Map<string, { gain: number; muted: boolean; solo: boolean }> = new Map();

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  async initializeAudioContext() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async loadAudioFile(id: string, file: File): Promise<void> {
    try {
      console.log(`Loading audio file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
      
      const arrayBuffer = await file.arrayBuffer();
      console.log(`ArrayBuffer loaded: ${arrayBuffer.byteLength} bytes`);
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.buffers.set(id, audioBuffer);

      // Create gain node for this stem
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.masterGain);
      this.gainNodes.set(id, gainNode);

      // Initialize stem state
      this.stemStates.set(id, { gain: 0, muted: false, solo: false });

      console.log(`✅ Audio file loaded successfully: ${id}`);
      console.log(`   Duration: ${audioBuffer.duration.toFixed(2)}s`);
      console.log(`   Sample Rate: ${audioBuffer.sampleRate}Hz`);
      console.log(`   Channels: ${audioBuffer.numberOfChannels}`);
      
      // Test audio context state
      console.log(`   AudioContext State: ${this.audioContext.state}`);
      
    } catch (error) {
      console.error(`❌ Failed to load audio file ${id}:`, error);
      if (error instanceof Error) {
        console.error(`   Error details: ${error.message}`);
      }
    }
  }

  setStemGain(id: string, gainValue: number) {
    const state = this.stemStates.get(id);
    if (state) {
      state.gain = gainValue;
      this.updateStemGain(id);
    }
  }

  setStemMute(id: string, muted: boolean) {
    const state = this.stemStates.get(id);
    if (state) {
      state.muted = muted;
      this.updateStemGain(id);
    }
  }

  private updateStemGain(id: string) {
    const gainNode = this.gainNodes.get(id);
    const state = this.stemStates.get(id);
    
    if (gainNode && state) {
      let finalGain = 0;
      
      if (!state.muted) {
        // Convert dB to linear gain
        finalGain = Math.pow(10, state.gain / 20);
      }
      
      gainNode.gain.setValueAtTime(finalGain, this.audioContext.currentTime);
      console.log(`🔊 Updated gain for ${id}: ${state.gain}dB (linear: ${finalGain.toFixed(3)}, muted: ${state.muted})`);
    }
  }

  setStemSolo(id: string, solo: boolean, allStemIds: string[]) {
    // Update solo state
    const state = this.stemStates.get(id);
    if (state) {
      state.solo = solo;
    }

    if (solo) {
      // Set all other stems to not solo
      allStemIds.forEach(stemId => {
        if (stemId !== id) {
          const otherState = this.stemStates.get(stemId);
          if (otherState) {
            otherState.solo = false;
          }
        }
      });
    }

    // Update all gain nodes based on solo state
    const anySolo = Array.from(this.stemStates.values()).some(s => s.solo);
    
    allStemIds.forEach(stemId => {
      const stemState = this.stemStates.get(stemId);
      if (stemState) {
        if (anySolo) {
          // If any stem is soloed, only play soloed stems
          stemState.muted = !stemState.solo;
        } else {
          // If no stems are soloed, restore original mute states
          // This would need to be tracked separately for proper restore
          stemState.muted = false;
        }
        this.updateStemGain(stemId);
      }
    });
  }

  async play() {
    if (this.isPlaying) return;

    console.log('▶️ Starting playback...');
    
    // Ensure audio context is running
    await this.initializeAudioContext();
    console.log(`   AudioContext state after init: ${this.audioContext.state}`);
    
    this.sources.clear();
    const currentTime = this.audioContext.currentTime;
    const offset = this.pauseTime;

    console.log(`   Buffers available: ${this.buffers.size}`);
    console.log(`   Starting from offset: ${offset.toFixed(2)}s`);

    // Create and start sources for all loaded buffers
    let sourcesCreated = 0;
    for (const [id, buffer] of this.buffers) {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = this.gainNodes.get(id);
      if (gainNode) {
        source.connect(gainNode);
        console.log(`   🔗 Connected source ${id} to gain node`);
        
        // Apply current gain settings
        this.updateStemGain(id);
        
        try {
          source.start(currentTime, offset);
          this.sources.set(id, source);
          sourcesCreated++;
          console.log(`   ✅ Started source ${id}`);
        } catch (error) {
          console.error(`   ❌ Failed to start source ${id}:`, error);
        }
      } else {
        console.error(`   ❌ No gain node found for ${id}`);
      }
    }

    console.log(`   🎵 Created ${sourcesCreated} audio sources`);
    console.log(`   🔊 Master gain: ${this.masterGain.gain.value}`);

    this.startTime = currentTime - offset;
    this.isPlaying = true;
    
    console.log('✅ Playback started successfully');
  }

  pause() {
    if (!this.isPlaying) return;

    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.stopAllSources();
    this.isPlaying = false;
  }

  stop() {
    this.stopAllSources();
    this.pauseTime = 0;
    this.isPlaying = false;
  }

  private stopAllSources() {
    for (const source of this.sources.values()) {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped
      }
    }
    this.sources.clear();
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseTime;
  }

  getDuration(): number {
    let maxDuration = 0;
    for (const buffer of this.buffers.values()) {
      maxDuration = Math.max(maxDuration, buffer.duration);
    }
    return maxDuration;
  }

  seekTo(time: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pauseTime = Math.max(0, Math.min(time, this.getDuration()));
    if (wasPlaying) {
      this.play();
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  removeStem(id: string) {
    const source = this.sources.get(id);
    if (source) {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped
      }
      this.sources.delete(id);
    }

    const gainNode = this.gainNodes.get(id);
    if (gainNode) {
      gainNode.disconnect();
      this.gainNodes.delete(id);
    }

    this.buffers.delete(id);
    this.stemStates.delete(id);
    console.log(`🗑️ Removed stem: ${id}`);
  }

  // Debug method to check audio system state
  getDebugInfo() {
    return {
      audioContextState: this.audioContext.state,
      buffersLoaded: this.buffers.size,
      gainNodesCreated: this.gainNodes.size,
      sourcesActive: this.sources.size,
      isPlaying: this.isPlaying,
      masterGainValue: this.masterGain.gain.value,
      stemStates: Array.from(this.stemStates.entries())
    };
  }

  dispose() {
    this.stop();
    this.audioContext.close();
  }
}