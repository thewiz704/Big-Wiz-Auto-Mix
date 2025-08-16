import React, { useState, useEffect, useRef } from 'react';
import './UtilitiesPanel.css';

interface UtilitiesPanelProps {
  audioContext: AudioContext;
  inputNode?: AudioNode;
  onAnalysisUpdate?: (analysis: UtilityAnalysis) => void;
}

interface UtilityAnalysis {
  correlation: number;
  dcOffset: { left: number; right: number };
  monoCompatibility: number;
  phaseCoherence: number;
  stereoWidth: number;
  peakHold: { left: number; right: number };
}

export const UtilitiesPanel: React.FC<UtilitiesPanelProps> = ({
  audioContext,
  inputNode,
  onAnalysisUpdate
}) => {
  const [analysis, setAnalysis] = useState<UtilityAnalysis>({
    correlation: 0,
    dcOffset: { left: 0, right: 0 },
    monoCompatibility: 100,
    phaseCoherence: 0,
    stereoWidth: 100,
    peakHold: { left: -60, right: -60 }
  });
  
  const [monoCheck, setMonoCheck] = useState(false);
  const [dcFixEnabled, setDcFixEnabled] = useState(false);
  const [phaseInvert, setPhaseInvert] = useState({ left: false, right: false });
  const [channelSwap, setChannelSwap] = useState(false);
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const dcFiltersRef = useRef<{ left: BiquadFilterNode; right: BiquadFilterNode } | null>(null);
  const phaseInvertersRef = useRef<{ left: GainNode; right: GainNode } | null>(null);
  const monoGainRef = useRef<GainNode | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!audioContext || !inputNode) return;

    // Setup audio analysis chain
    setupAnalysisChain();
    
    // Start analysis updates
    updateIntervalRef.current = setInterval(updateAnalysis, 50); // 20Hz update rate

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      cleanupNodes();
    };
  }, [audioContext, inputNode]);

  const setupAnalysisChain = () => {
    if (!audioContext || !inputNode) return;

    cleanupNodes();

    // Create analysis nodes
    analyserRef.current = audioContext.createAnalyser();
    analyserRef.current.fftSize = 2048;
    analyserRef.current.smoothingTimeConstant = 0.8;

    splitterRef.current = audioContext.createChannelSplitter(2);
    mergerRef.current = audioContext.createChannelMerger(2);

    // Create DC removal filters
    dcFiltersRef.current = {
      left: audioContext.createBiquadFilter(),
      right: audioContext.createBiquadFilter()
    };
    
    dcFiltersRef.current.left.type = 'highpass';
    dcFiltersRef.current.left.frequency.setValueAtTime(5, audioContext.currentTime);
    dcFiltersRef.current.left.Q.setValueAtTime(0.707, audioContext.currentTime);
    
    dcFiltersRef.current.right.type = 'highpass';
    dcFiltersRef.current.right.frequency.setValueAtTime(5, audioContext.currentTime);
    dcFiltersRef.current.right.Q.setValueAtTime(0.707, audioContext.currentTime);

    // Create phase inverters
    phaseInvertersRef.current = {
      left: audioContext.createGain(),
      right: audioContext.createGain()
    };

    // Create mono gain node
    monoGainRef.current = audioContext.createGain();

    // Connect initial chain
    inputNode.connect(splitterRef.current);
    updateAudioChain();
    
    // Connect to analyser for measurements
    mergerRef.current.connect(analyserRef.current);
  };

  const updateAudioChain = () => {
    if (!splitterRef.current || !mergerRef.current || !dcFiltersRef.current || !phaseInvertersRef.current || !monoGainRef.current) {
      return;
    }

    // Disconnect all connections to rebuild
    try {
      splitterRef.current.disconnect();
      mergerRef.current.disconnect();
      dcFiltersRef.current.left.disconnect();
      dcFiltersRef.current.right.disconnect();
      phaseInvertersRef.current.left.disconnect();
      phaseInvertersRef.current.right.disconnect();
      monoGainRef.current.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }

    // Left channel chain
    let leftSource = splitterRef.current;
    let rightSource = splitterRef.current;

    // Handle channel swap
    if (channelSwap) {
      leftSource.connect(dcFiltersRef.current.right, 0);
      rightSource.connect(dcFiltersRef.current.left, 1);
    } else {
      leftSource.connect(dcFiltersRef.current.left, 0);
      rightSource.connect(dcFiltersRef.current.right, 1);
    }

    // DC removal (if enabled)
    if (dcFixEnabled) {
      dcFiltersRef.current.left.connect(phaseInvertersRef.current.left);
      dcFiltersRef.current.right.connect(phaseInvertersRef.current.right);
    } else {
      // Bypass DC filters
      if (channelSwap) {
        splitterRef.current.connect(phaseInvertersRef.current.right, 0);
        splitterRef.current.connect(phaseInvertersRef.current.left, 1);
      } else {
        splitterRef.current.connect(phaseInvertersRef.current.left, 0);
        splitterRef.current.connect(phaseInvertersRef.current.right, 1);
      }
    }

    // Phase inversion
    phaseInvertersRef.current.left.gain.setValueAtTime(
      phaseInvert.left ? -1 : 1, 
      audioContext.currentTime
    );
    phaseInvertersRef.current.right.gain.setValueAtTime(
      phaseInvert.right ? -1 : 1, 
      audioContext.currentTime
    );

    // Mono check
    if (monoCheck) {
      // Sum to mono
      phaseInvertersRef.current.left.connect(monoGainRef.current);
      phaseInvertersRef.current.right.connect(monoGainRef.current);
      monoGainRef.current.gain.setValueAtTime(0.5, audioContext.currentTime);
      
      // Output mono to both channels
      monoGainRef.current.connect(mergerRef.current, 0, 0);
      monoGainRef.current.connect(mergerRef.current, 0, 1);
    } else {
      // Stereo output
      phaseInvertersRef.current.left.connect(mergerRef.current, 0, 0);
      phaseInvertersRef.current.right.connect(mergerRef.current, 0, 1);
    }
  };

  const updateAnalysis = () => {
    if (!analyserRef.current || !splitterRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    // Calculate correlation and other metrics
    const newAnalysis = calculateAudioMetrics(dataArray);
    
    setAnalysis(newAnalysis);
    
    if (onAnalysisUpdate) {
      onAnalysisUpdate(newAnalysis);
    }
  };

  const calculateAudioMetrics = (audioData: Float32Array): UtilityAnalysis => {
    const halfLength = audioData.length / 2;
    const leftChannel = audioData.slice(0, halfLength);
    const rightChannel = audioData.slice(halfLength);

    // Calculate correlation
    const correlation = calculateCorrelation(leftChannel, rightChannel);

    // Calculate DC offset
    const leftDC = calculateDCOffset(leftChannel);
    const rightDC = calculateDCOffset(rightChannel);

    // Calculate mono compatibility
    const monoCompatibility = calculateMonoCompatibility(leftChannel, rightChannel);

    // Calculate phase coherence
    const phaseCoherence = calculatePhaseCoherence(leftChannel, rightChannel);

    // Calculate stereo width
    const stereoWidth = calculateStereoWidth(leftChannel, rightChannel);

    // Calculate peak levels
    const leftPeak = 20 * Math.log10(Math.max(...leftChannel.map(Math.abs)));
    const rightPeak = 20 * Math.log10(Math.max(...rightChannel.map(Math.abs)));

    return {
      correlation,
      dcOffset: { left: leftDC, right: rightDC },
      monoCompatibility,
      phaseCoherence,
      stereoWidth,
      peakHold: { left: leftPeak, right: rightPeak }
    };
  };

  const calculateCorrelation = (left: Float32Array, right: Float32Array): number => {
    const length = Math.min(left.length, right.length);
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < length; i++) {
      sumXY += left[i] * right[i];
      sumX += left[i];
      sumY += right[i];
      sumX2 += left[i] * left[i];
      sumY2 += right[i] * right[i];
    }

    const numerator = length * sumXY - sumX * sumY;
    const denominator = Math.sqrt((length * sumX2 - sumX * sumX) * (length * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const calculateDCOffset = (channel: Float32Array): number => {
    return channel.reduce((sum, sample) => sum + sample, 0) / channel.length;
  };

  const calculateMonoCompatibility = (left: Float32Array, right: Float32Array): number => {
    // Calculate how much information is lost when summed to mono
    let monoEnergy = 0;
    let stereoEnergy = 0;

    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const mono = (left[i] + right[i]) / 2;
      const side = (left[i] - right[i]) / 2;
      
      monoEnergy += mono * mono;
      stereoEnergy += (left[i] * left[i] + right[i] * right[i]) / 2;
    }

    return stereoEnergy === 0 ? 100 : (monoEnergy / stereoEnergy) * 100;
  };

  const calculatePhaseCoherence = (left: Float32Array, right: Float32Array): number => {
    // Simplified phase coherence calculation
    let coherence = 0;
    const length = Math.min(left.length, right.length);

    for (let i = 1; i < length; i++) {
      const leftPhase = Math.atan2(left[i], left[i - 1]);
      const rightPhase = Math.atan2(right[i], right[i - 1]);
      const phaseDiff = Math.abs(leftPhase - rightPhase);
      coherence += Math.cos(phaseDiff);
    }

    return (coherence / (length - 1)) * 100;
  };

  const calculateStereoWidth = (left: Float32Array, right: Float32Array): number => {
    let midEnergy = 0;
    let sideEnergy = 0;

    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const mid = (left[i] + right[i]) / 2;
      const side = (left[i] - right[i]) / 2;
      
      midEnergy += mid * mid;
      sideEnergy += side * side;
    }

    const totalEnergy = midEnergy + sideEnergy;
    return totalEnergy === 0 ? 0 : (sideEnergy / totalEnergy) * 200; // 0-200% range
  };

  const cleanupNodes = () => {
    if (analyserRef.current) analyserRef.current.disconnect();
    if (splitterRef.current) splitterRef.current.disconnect();
    if (mergerRef.current) mergerRef.current.disconnect();
    if (dcFiltersRef.current) {
      dcFiltersRef.current.left.disconnect();
      dcFiltersRef.current.right.disconnect();
    }
    if (phaseInvertersRef.current) {
      phaseInvertersRef.current.left.disconnect();
      phaseInvertersRef.current.right.disconnect();
    }
    if (monoGainRef.current) monoGainRef.current.disconnect();
  };

  const handleMonoCheck = (enabled: boolean) => {
    setMonoCheck(enabled);
    updateAudioChain();
  };

  const handleDCFix = (enabled: boolean) => {
    setDcFixEnabled(enabled);
    updateAudioChain();
  };

  const handlePhaseInvert = (channel: 'left' | 'right') => {
    setPhaseInvert(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
    updateAudioChain();
  };

  const handleChannelSwap = () => {
    setChannelSwap(prev => !prev);
    updateAudioChain();
  };

  const getCorrelationStatus = (correlation: number) => {
    if (correlation > 0.9) return { status: 'excellent', color: '#4ade80' };
    if (correlation > 0.7) return { status: 'good', color: '#fbbf24' };
    if (correlation > 0.3) return { status: 'fair', color: '#f97316' };
    return { status: 'poor', color: '#ef4444' };
  };

  const getMonoCompatibilityStatus = (compatibility: number) => {
    if (compatibility > 90) return { status: 'excellent', color: '#4ade80' };
    if (compatibility > 75) return { status: 'good', color: '#fbbf24' };
    if (compatibility > 50) return { status: 'fair', color: '#f97316' };
    return { status: 'poor', color: '#ef4444' };
  };

  const correlationStatus = getCorrelationStatus(analysis.correlation);
  const monoStatus = getMonoCompatibilityStatus(analysis.monoCompatibility);

  return (
    <div className="utilities-panel">
      <div className="panel-header">
        <h3>Audio Utilities</h3>
      </div>

      <div className="utilities-grid">
        {/* Analysis Meters */}
        <div className="analysis-section">
          <h4>Analysis</h4>
          
          <div className="meter-row">
            <label>Correlation</label>
            <div className="meter-container">
              <div 
                className="correlation-meter"
                style={{ backgroundColor: correlationStatus.color + '20' }}
              >
                <div 
                  className="meter-fill"
                  style={{ 
                    width: `${(analysis.correlation + 1) * 50}%`,
                    backgroundColor: correlationStatus.color
                  }}
                />
              </div>
              <span className="meter-value">
                {analysis.correlation.toFixed(3)}
              </span>
            </div>
          </div>

          <div className="meter-row">
            <label>Mono Compat</label>
            <div className="meter-container">
              <div 
                className="mono-meter"
                style={{ backgroundColor: monoStatus.color + '20' }}
              >
                <div 
                  className="meter-fill"
                  style={{ 
                    width: `${analysis.monoCompatibility}%`,
                    backgroundColor: monoStatus.color
                  }}
                />
              </div>
              <span className="meter-value">
                {analysis.monoCompatibility.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="meter-row">
            <label>Stereo Width</label>
            <div className="meter-container">
              <div className="width-meter">
                <div 
                  className="meter-fill"
                  style={{ 
                    width: `${Math.min(analysis.stereoWidth, 200) / 2}%`,
                    backgroundColor: '#60a5fa'
                  }}
                />
              </div>
              <span className="meter-value">
                {analysis.stereoWidth.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="dc-offset-display">
            <label>DC Offset</label>
            <div className="dc-values">
              <span className={Math.abs(analysis.dcOffset.left) > 0.01 ? 'warning' : ''}>
                L: {(analysis.dcOffset.left * 1000).toFixed(2)}mV
              </span>
              <span className={Math.abs(analysis.dcOffset.right) > 0.01 ? 'warning' : ''}>
                R: {(analysis.dcOffset.right * 1000).toFixed(2)}mV
              </span>
            </div>
          </div>
        </div>

        {/* Utility Controls */}
        <div className="controls-section">
          <h4>Controls</h4>
          
          <div className="control-group">
            <button 
              className={`utility-button ${monoCheck ? 'active' : ''}`}
              onClick={() => handleMonoCheck(!monoCheck)}
              title="Check mono compatibility"
            >
              <span className="button-icon">🔉</span>
              Mono Check
            </button>

            <button 
              className={`utility-button ${dcFixEnabled ? 'active' : ''}`}
              onClick={() => handleDCFix(!dcFixEnabled)}
              title="Remove DC offset"
            >
              <span className="button-icon">🔧</span>
              DC Fix
            </button>

            <button 
              className={`utility-button ${channelSwap ? 'active' : ''}`}
              onClick={handleChannelSwap}
              title="Swap left and right channels"
            >
              <span className="button-icon">🔄</span>
              L/R Swap
            </button>
          </div>

          <div className="phase-controls">
            <label>Phase Invert</label>
            <div className="phase-buttons">
              <button 
                className={`phase-button ${phaseInvert.left ? 'active' : ''}`}
                onClick={() => handlePhaseInvert('left')}
                title="Invert left channel phase"
              >
                L ∅
              </button>
              <button 
                className={`phase-button ${phaseInvert.right ? 'active' : ''}`}
                onClick={() => handlePhaseInvert('right')}
                title="Invert right channel phase"
              >
                R ∅
              </button>
            </div>
          </div>
        </div>

        {/* Peak Hold Display */}
        <div className="peaks-section">
          <h4>Peak Hold</h4>
          <div className="peak-displays">
            <div className="peak-channel">
              <label>L</label>
              <span className={analysis.peakHold.left > -3 ? 'warning' : ''}>
                {analysis.peakHold.left.toFixed(1)} dB
              </span>
            </div>
            <div className="peak-channel">
              <label>R</label>
              <span className={analysis.peakHold.right > -3 ? 'warning' : ''}>
                {analysis.peakHold.right.toFixed(1)} dB
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};