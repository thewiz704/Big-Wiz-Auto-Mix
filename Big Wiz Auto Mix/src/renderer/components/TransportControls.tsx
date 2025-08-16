import React from 'react';
import styled from 'styled-components';

const TransportContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  margin: 16px;
`;

const TransportButton = styled.button<{ active?: boolean }>`
  background: ${props => props.active ? '#0078d4' : 'rgba(255, 255, 255, 0.1)'};
  border: 1px solid ${props => props.active ? '#106ebe' : '#555'};
  color: #ffffff;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.active ? '#106ebe' : 'rgba(255, 255, 255, 0.15)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TimeDisplay = styled.div`
  background: #0a0a0a;
  border: 1px solid #333;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: #4a9eff;
  min-width: 80px;
  text-align: center;
`;

const ProgressContainer = styled.div`
  flex: 1;
  height: 6px;
  background: #333;
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  margin: 0 12px;
`;

const ProgressBar = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #4a9eff 0%, #5aafff 100%);
  border-radius: 3px;
  width: ${props => props.progress}%;
  transition: width 0.1s ease;
`;

const ProgressHandle = styled.div<{ position: number }>`
  position: absolute;
  top: 50%;
  left: ${props => props.position}%;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border: 2px solid #4a9eff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
  }
`;

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
  audioManager?: any;
}

const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
  disabled = false,
  audioManager
}) => {
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  const handleDebugAudio = () => {
    if (audioManager && audioManager.getDebugInfo) {
      const debugInfo = audioManager.getDebugInfo();
      console.log('🔍 Audio System Debug Info:', debugInfo);
      
      // Also check browser audio capabilities
      console.log('🌐 Browser Audio Support:');
      console.log('  - AudioContext supported:', !!(window.AudioContext || (window as any).webkitAudioContext));
      console.log('  - Web Audio API supported:', !!(window.AudioContext));
      console.log('  - Current page URL:', window.location.href);
      console.log('  - Is secure context:', window.isSecureContext);
      
      alert(`Audio Debug Info:\n\nAudioContext State: ${debugInfo.audioContextState}\nBuffers Loaded: ${debugInfo.buffersLoaded}\nGain Nodes: ${debugInfo.gainNodesCreated}\nActive Sources: ${debugInfo.sourcesActive}\nIs Playing: ${debugInfo.isPlaying}\nMaster Gain: ${debugInfo.masterGainValue}\n\nCheck console for detailed info.`);
    }
  };

  return (
    <TransportContainer>
      <TransportButton onClick={onStop} disabled={disabled}>
        ⏹
      </TransportButton>
      
      <TransportButton 
        onClick={isPlaying ? onPause : onPlay} 
        active={isPlaying}
        disabled={disabled}
      >
        {isPlaying ? '⏸' : '▶'}
      </TransportButton>
      
      <TimeDisplay>
        {formatTime(currentTime)}
      </TimeDisplay>
      
      <ProgressContainer onClick={handleProgressClick}>
        <ProgressBar progress={progress} />
        <ProgressHandle position={progress} />
      </ProgressContainer>
      
      <TimeDisplay>
        {formatTime(duration)}
      </TimeDisplay>
      
      {audioManager && (
        <TransportButton 
          onClick={handleDebugAudio}
          title="Debug audio system (check console)"
          style={{ fontSize: '12px', width: '32px', height: '32px' }}
        >
          🔍
        </TransportButton>
      )}
    </TransportContainer>
  );
};

export default TransportControls;