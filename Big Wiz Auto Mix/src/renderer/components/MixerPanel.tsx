import React, { useState } from 'react';
import styled from 'styled-components';
import { StemFile, AnalysisData, MixerSettings } from '../../shared/types';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import Vectorscope from './Vectorscope';
import LUFSMeter from './LUFSMeter';
import TransportControls from './TransportControls';
import VisualMixer from './VisualMixer';

const MixerPanelContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1e1e1e 0%, #1a1a1a 100%);
`;

const TabBar = styled.div`
  display: flex;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid #444;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 12px 20px;
  background: ${props => props.active ? '#4a9eff' : 'transparent'};
  border: none;
  color: ${props => props.active ? '#ffffff' : '#ccc'};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid ${props => props.active ? '#4a9eff' : 'transparent'};
  
  &:hover {
    background: ${props => props.active ? '#4a9eff' : 'rgba(255, 255, 255, 0.05)'};
    color: #ffffff;
  }
`;

const TabContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

const MixerSection = styled.div`
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
`;

const MixerTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
`;

const ChannelStrips = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
`;

const ChannelStrip = styled.div`
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 16px 12px;
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const ChannelLabel = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: #ccc;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-height: 24px;
  display: flex;
  align-items: center;
`;

const FaderContainer = styled.div`
  height: 200px;
  width: 30px;
  background: #333;
  border-radius: 15px;
  position: relative;
  border: 1px solid #555;
`;

const FaderTrack = styled.div`
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 2px;
  background: #666;
  transform: translateX(-50%);
`;

const SnapLines = styled.div`
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  right: 0;
  pointer-events: none;
`;

const SnapLine = styled.div<{ position: number; type: 'unity' | 'cut' | 'boost' }>`
  position: absolute;
  top: ${props => props.position}%;
  left: 2px;
  right: 2px;
  height: 1px;
  background: ${props => {
    switch (props.type) {
      case 'unity': return '#4a9eff';
      case 'cut': return '#ff6b35';
      case 'boost': return '#2ed573';
      default: return '#555';
    }
  }};
  opacity: 0.6;
  
  &::after {
    content: '${props => {
      switch (props.type) {
        case 'unity': return '0dB';
        case 'cut': return '-6';
        case 'boost': return '+6';
        default: return '';
      }
    }}';
    position: absolute;
    right: -20px;
    top: -6px;
    font-size: 8px;
    color: ${props => {
      switch (props.type) {
        case 'unity': return '#4a9eff';
        case 'cut': return '#ff6b35';
        case 'boost': return '#2ed573';
        default: return '#555';
      }
    }};
  }
`;

const FaderHandle = styled.div<{ position: number }>`
  position: absolute;
  width: 26px;
  height: 20px;
  background: linear-gradient(180deg, #4a9eff 0%, #3a8eef 100%);
  border: 1px solid #2a7edf;
  border-radius: 4px;
  cursor: pointer;
  transform: translateX(-50%);
  left: 50%;
  top: ${props => props.position}%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background: linear-gradient(180deg, #5aafff 0%, #4a9eff 100%);
  }
`;

const LoudnessIndicator = styled.div<{ size: number; lufs: number }>`
  position: absolute;
  width: ${props => Math.max(8, props.size)}px;
  height: ${props => Math.max(8, props.size)}px;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  
  &::before {
    content: '★';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: ${props => Math.max(8, props.size)}px;
    color: ${props => {
      if (props.lufs > -12) return '#ff4757'; // Too loud - red star
      if (props.lufs > -18) return '#ffa502'; // Moderate - orange star
      return '#2ed573'; // Good - green star
    }};
    text-shadow: 0 0 ${props => props.size / 4}px currentColor;
    filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
  }
`;

const GainValue = styled.div`
  font-size: 10px;
  color: #999;
  text-align: center;
  min-height: 16px;
`;

const MasterSection = styled.div`
  background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
  border: 2px solid #555;
  border-radius: 8px;
  padding: 20px;
  margin: 0 auto;
  width: 120px;
`;

const MasterFader = styled(ChannelStrip)`
  width: 100px;
  background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
  border: 2px solid #4a9eff;
`;

const TruePeakMeter = styled.div`
  width: 12px;
  height: 200px;
  background: #222;
  border: 1px solid #444;
  border-radius: 2px;
  position: relative;
  margin-left: 8px;
`;

const PeakMeterFill = styled.div<{ level: number; clipping: boolean }>`
  position: absolute;
  bottom: 0;
  width: 100%;
  height: ${props => Math.max(0, Math.min(100, props.level))}%;
  background: ${props => {
    if (props.clipping) return 'linear-gradient(0deg, #ff4757 0%, #ff6b7a 100%)';
    if (props.level > 90) return 'linear-gradient(0deg, #ffa502 0%, #ffb347 100%)';
    return 'linear-gradient(0deg, #2ed573 0%, #55efc4 100%)';
  }};
  border-radius: 1px;
  transition: height 0.05s ease-out;
`;

const PeakMeterLabel = styled.div`
  font-size: 9px;
  color: #ccc;
  text-align: center;
  margin-top: 4px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
`;

interface MixerPanelProps {
  stems: StemFile[];
  analysisData: AnalysisData;
  mixerSettings: MixerSettings;
  updateStem?: (id: string, updates: Partial<StemFile>) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  audioManager?: any;
}

const MixerPanel: React.FC<MixerPanelProps> = ({ 
  stems, 
  analysisData, 
  mixerSettings, 
  updateStem,
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
  audioManager
}) => {
  const [activeTab, setActiveTab] = useState<'mixer' | 'visual' | 'spectrum' | 'vectorscope' | 'lufs'>('mixer');
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [deltaMode, setDeltaMode] = useState<boolean>(false);
  const [truePeakLevel, setTruePeakLevel] = useState<number>(0);
  const [isClipping, setIsClipping] = useState<boolean>(false);

  const handleFaderMouseDown = (stemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(stemId);
  };

  const handleFaderDoubleClick = (stemId: string) => {
    if (updateStem) {
      updateStem(stemId, { gain: 0 }); // Reset to 0dB
    }
  };

  const handleFaderRightClick = (stemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const stem = stems.find(s => s.id === stemId);
    if (stem && updateStem) {
      if (stem.solo) {
        updateStem(stemId, { solo: false });
      } else if (stem.muted) {
        updateStem(stemId, { muted: false });
      } else {
        updateStem(stemId, { muted: true });
      }
    }
  };

  const handleFaderMouseMove = (e: MouseEvent, stemId: string, faderRect: DOMRect) => {
    if (isDragging !== stemId) return;
    
    const y = e.clientY - faderRect.top;
    const percentage = Math.max(0, Math.min(1, 1 - (y / faderRect.height)));
    const gainValue = (percentage * 120) - 60; // -60dB to +60dB range
    
    if (updateStem) {
      updateStem(stemId, { gain: gainValue });
    }
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const faderContainer = document.querySelector(`[data-stem-id="${isDragging}"]`) as HTMLElement;
      if (faderContainer) {
        const rect = faderContainer.getBoundingClientRect();
        handleFaderMouseMove(e, isDragging, rect);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Simulate true peak meter updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && stems.length > 0) {
        // Mock true peak calculation with 4x oversampling simulation
        const randomPeak = Math.random() * 100;
        const clippingThreshold = 98; // -0.1 dBFS equivalent
        
        setTruePeakLevel(randomPeak);
        setIsClipping(randomPeak > clippingThreshold);
      } else {
        setTruePeakLevel(0);
        setIsClipping(false);
      }
    }, 50); // 20 updates per second for smooth metering

    return () => clearInterval(interval);
  }, [isPlaying, stems]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mixer':
        return (
          <MixerSection>
            <TransportControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onPlay={onPlay}
              onPause={onPause}
              onStop={onStop}
              onSeek={onSeek}
              disabled={stems.length === 0}
              audioManager={audioManager}
            />
            <MixerTitle>Visual Mixer</MixerTitle>
            {stems.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#666',
                padding: '40px 20px',
                fontSize: '14px'
              }}>
                Load stems to analyze
              </div>
            ) : (
              <ChannelStrips>
              {stems.map((stem) => {
                // Mock LUFS calculation based on gain and stem type
                const baseLUFS = -20 + (stem.gain * 0.8); // Rough approximation
                const stemLUFS = Math.max(-40, Math.min(-6, baseLUFS));
                const indicatorSize = Math.max(6, Math.min(20, Math.abs(stemLUFS + 30) * 0.8));
                
                return (
                  <ChannelStrip key={stem.id}>
                    <ChannelLabel>{stem.name}</ChannelLabel>
                    <FaderContainer 
                      data-stem-id={stem.id}
                      onMouseDown={(e) => handleFaderMouseDown(stem.id, e)}
                      onDoubleClick={() => handleFaderDoubleClick(stem.id)}
                      onContextMenu={(e) => handleFaderRightClick(stem.id, e)}
                      style={{ 
                        position: 'relative',
                        cursor: 'pointer',
                        opacity: stem.muted ? 0.5 : 1,
                        border: stem.solo ? '2px solid #ffa502' : '1px solid #555'
                      }}
                      title="Double-click: Reset to 0dB | Right-click: Mute/Solo"
                    >
                      <SnapLines>
                        <SnapLine position={100 - ((0 + 60) / 120) * 100} type="unity" />
                        <SnapLine position={100 - ((-6 + 60) / 120) * 100} type="cut" />
                        <SnapLine position={100 - ((6 + 60) / 120) * 100} type="boost" />
                      </SnapLines>
                      <FaderTrack />
                      <FaderHandle position={100 - ((stem.gain + 60) / 120) * 100} />
                      <LoudnessIndicator size={indicatorSize} lufs={stemLUFS} />
                      {stem.muted && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          fontSize: '10px',
                          color: '#ff4757',
                          fontWeight: 'bold'
                        }}>
                          M
                        </div>
                      )}
                      {stem.solo && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          fontSize: '10px',
                          color: '#ffa502',
                          fontWeight: 'bold'
                        }}>
                          S
                        </div>
                      )}
                    </FaderContainer>
                    <GainValue>{stem.gain > 0 ? '+' : ''}{stem.gain.toFixed(1)} dB</GainValue>
                    <div style={{ 
                      fontSize: '9px', 
                      color: stemLUFS > -12 ? '#ff4757' : stemLUFS > -18 ? '#ffa502' : '#2ed573',
                      textAlign: 'center' 
                    }}>
                      {stemLUFS.toFixed(1)} LUFS
                    </div>
                  </ChannelStrip>
                );
              })}
            </ChannelStrips>
            )}
            <MasterSection>
              <MasterFader>
                <ChannelLabel>Master</ChannelLabel>
                <FaderContainer>
                  <FaderTrack />
                  <FaderHandle position={50} />
                </FaderContainer>
                <GainValue>0.0 dB</GainValue>
              </MasterFader>
              <TruePeakMeter>
                <PeakMeterFill level={truePeakLevel} clipping={isClipping} />
                <div style={{
                  position: 'absolute',
                  top: '5px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '8px',
                  color: '#999',
                  writingMode: 'vertical-rl' as const
                }}>
                  TP
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '8px',
                  color: isClipping ? '#ff4757' : '#ccc',
                  whiteSpace: 'nowrap'
                }}>
                  {isClipping ? 'CLIP!' : `${(truePeakLevel - 100).toFixed(1)}`}
                </div>
              </TruePeakMeter>
            </MasterSection>
          </MixerSection>
        );
      case 'visual':
        return stems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
            Load stems to analyze
          </div>
        ) : (
          <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TransportControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onPlay={onPlay}
              onPause={onPause}
              onStop={onStop}
              onSeek={onSeek}
              disabled={stems.length === 0}
              audioManager={audioManager}
            />
            <VisualMixer 
              stems={stems} 
              updateStem={updateStem || (() => {})}
              onAutoSpread={() => console.log('Auto-spread triggered')}
            />
          </div>
        );
      case 'spectrum':
        return stems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
            Load stems to analyze
          </div>
        ) : (
          <SpectrumAnalyzer data={analysisData.spectrum} referenceData={analysisData.referenceSpectrum} />
        );
      case 'vectorscope':
        return stems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
            Load stems to analyze
          </div>
        ) : (
          <Vectorscope data={analysisData.vectorscope} />
        );
      case 'lufs':
        return stems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
            Load stems to analyze
          </div>
        ) : (
          <LUFSMeter lufs={analysisData.lufs} peak={analysisData.peak} />
        );
      default:
        return null;
    }
  };

  return (
    <MixerPanelContainer>
      <TabBar>
        <Tab active={activeTab === 'mixer'} onClick={() => setActiveTab('mixer')}>
          Mixer
        </Tab>
        <Tab active={activeTab === 'visual'} onClick={() => setActiveTab('visual')}>
          Visual
        </Tab>
        <Tab active={activeTab === 'spectrum'} onClick={() => setActiveTab('spectrum')}>
          Spectrum
        </Tab>
        <Tab active={activeTab === 'vectorscope'} onClick={() => setActiveTab('vectorscope')}>
          Vectorscope
        </Tab>
        <Tab active={activeTab === 'lufs'} onClick={() => setActiveTab('lufs')}>
          LUFS
        </Tab>
        <Tab 
          active={deltaMode} 
          onClick={() => setDeltaMode(!deltaMode)}
          style={{ marginLeft: 'auto', backgroundColor: deltaMode ? '#ff6b35' : 'transparent' }}
        >
          Δ (Raw vs Processed)
        </Tab>
      </TabBar>
      <TabContent>
        {renderTabContent()}
      </TabContent>
    </MixerPanelContainer>
  );
};

export default MixerPanel;