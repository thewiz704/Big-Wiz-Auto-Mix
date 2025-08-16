import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

const VectorscopeContainer = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CorrelationBar = styled.div`
  width: 300px;
  height: 12px;
  background: #222;
  border: 1px solid #444;
  border-radius: 6px;
  position: relative;
  margin-top: 16px;
`;

const CorrelationFill = styled.div<{ correlation: number }>`
  position: absolute;
  left: 50%;
  top: 0;
  height: 100%;
  width: ${props => Math.abs(props.correlation) * 50}%;
  background: ${props => {
    if (props.correlation < -0.5) return 'linear-gradient(90deg, #ff4757, #ff6b7a)'; // Red for negative correlation
    if (props.correlation > 0.8) return 'linear-gradient(90deg, #2ed573, #55efc4)'; // Green for good correlation
    return 'linear-gradient(90deg, #ffa502, #ffb347)'; // Orange for moderate
  }};
  border-radius: 6px;
  transform: ${props => props.correlation < 0 ? 'translateX(-100%)' : 'none'};
`;

const CorrelationLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: #666;
  width: 300px;
`;

const CorrelationValue = styled.div<{ correlation: number }>`
  font-size: 13px;
  font-weight: 600;
  color: ${props => {
    if (props.correlation < -0.5) return '#ff4757';
    if (props.correlation > 0.8) return '#2ed573';
    return '#ffa502';
  }};
  text-align: center;
  margin-top: 4px;
`;

const SafetyPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 8px;
  width: 300px;
`;

const SafetyPanelTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
  text-align: center;
  margin-bottom: 4px;
`;

const ABControls = styled.div`
  display: flex;
  gap: 8px;
`;

const ABButton = styled.button<{ active?: boolean; danger?: boolean }>`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid ${props => 
    props.danger ? '#ef4444' : 
    props.active ? '#0066cc' : '#444'};
  background: ${props => 
    props.danger ? 'linear-gradient(145deg, #ef4444, #dc2626)' :
    props.active ? 'linear-gradient(145deg, #0066cc, #004499)' : 
    'linear-gradient(145deg, #333, #222)'};
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const SafetyMetrics = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 10px;
`;

const SafetyMetric = styled.div<{ status: 'safe' | 'warning' | 'danger' }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border-left: 3px solid ${props => 
    props.status === 'safe' ? '#4ade80' :
    props.status === 'warning' ? '#fbbf24' : '#ef4444'
  };
  
  .label {
    color: #888;
    margin-bottom: 2px;
  }
  
  .value {
    color: ${props => 
      props.status === 'safe' ? '#4ade80' :
      props.status === 'warning' ? '#fbbf24' : '#ef4444'
    };
    font-weight: 600;
  }
`;

const VectorscopeTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
`;

const CanvasContainer = styled.div`
  flex: 1;
  width: 100%;
  max-width: 500px;
  aspect-ratio: 1;
  background: #0a0a0a;
  border: 1px solid #444;
  border-radius: 8px;
  position: relative;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  border-radius: 8px;
`;

const Labels = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  font-size: 10px;
  color: #666;
`;

const Label = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:nth-child(2) { justify-content: center; align-items: flex-start; padding-top: 8px; }
  &:nth-child(3) { justify-content: flex-end; align-items: flex-start; padding: 8px; }
  &:nth-child(4) { justify-content: flex-start; align-items: center; padding-left: 8px; }
  &:nth-child(6) { justify-content: flex-end; align-items: center; padding-right: 8px; }
  &:nth-child(7) { justify-content: flex-start; align-items: flex-end; padding: 8px; }
  &:nth-child(8) { justify-content: center; align-items: flex-end; padding-bottom: 8px; }
  &:nth-child(9) { justify-content: flex-end; align-items: flex-end; padding: 8px; }
`;

interface VectorscopeProps {
  data: { l: number; r: number }[];
  onABToggle?: (state: 'A' | 'B') => void;
  currentABState?: 'A' | 'B';
  safetyMetrics?: {
    peak: number;
    lufs: number;
    correlation: number;
    monoCompatibility: number;
  };
}

const Vectorscope: React.FC<VectorscopeProps> = ({ 
  data, 
  onABToggle, 
  currentABState = 'A',
  safetyMetrics 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Calculate mid/side correlation from stereo data
  const calculateCorrelation = (data: { l: number; r: number }[]) => {
    if (data.length === 0) return 0;
    
    // Simple correlation calculation based on L/R channel similarity
    let correlation = 0;
    for (let i = 0; i < data.length; i++) {
      const { l, r } = data[i];
      correlation += l * r; // Dot product indicates correlation
    }
    
    return Math.max(-1, Math.min(1, correlation / data.length));
  };
  
  const correlation = calculateCorrelation(data);

  // Determine safety status for metrics
  const getSafetyStatus = (value: number, type: 'peak' | 'lufs' | 'correlation' | 'mono'): 'safe' | 'warning' | 'danger' => {
    switch (type) {
      case 'peak':
        if (value > -1) return 'danger';
        if (value > -3) return 'warning';
        return 'safe';
      case 'lufs':
        if (Math.abs(value + 14) > 6) return 'danger';
        if (Math.abs(value + 14) > 3) return 'warning';
        return 'safe';
      case 'correlation':
        if (value < -0.5) return 'danger';
        if (value < 0.3) return 'warning';
        return 'safe';
      case 'mono':
        if (value < 50) return 'danger';
        if (value < 75) return 'warning';
        return 'safe';
      default:
        return 'safe';
    }
  };

  const handleABToggle = (state: 'A' | 'B') => {
    if (onABToggle) {
      onABToggle(state);
    }
  };

  const handlePanic = () => {
    // Panic button: instantly mute or bypass all processing
    console.log('PANIC: Emergency safety bypass triggered');
    // This would connect to the audio engine to immediately bypass all processing
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const x1 = centerX + Math.cos(angle) * (radius - 10);
      const y1 = centerY + Math.sin(angle) * (radius - 10);
      const x2 = centerX + Math.cos(angle) * radius;
      const y2 = centerY + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    if (data.length > 0) {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(74, 158, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(74, 158, 255, 0.2)');
      
      ctx.strokeStyle = '#4a9eff';
      ctx.fillStyle = gradient;
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const { l, r } = data[i];
        const x = centerX + (l * radius);
        const y = centerY + (r * radius);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      for (let i = 0; i < data.length; i += 5) {
        const { l, r } = data[i];
        const x = centerX + (l * radius);
        const y = centerY + (r * radius);
        
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, [data]);

  return (
    <VectorscopeContainer>
      <VectorscopeTitle>Vectorscope</VectorscopeTitle>
      <CanvasContainer>
        <Canvas ref={canvasRef} />
        <Labels>
          <div />
          <Label>M</Label>
          <div />
          <Label>L</Label>
          <div />
          <Label>R</Label>
          <div />
          <Label>S</Label>
          <div />
        </Labels>
      </CanvasContainer>
      
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '8px' }}>
          Mid/Side Correlation
        </div>
        <CorrelationBar>
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '2px',
            height: '100%',
            background: '#666',
            transform: 'translateX(-50%)'
          }} />
          <CorrelationFill correlation={correlation} />
        </CorrelationBar>
        <CorrelationLabel>
          <span>Out of Phase</span>
          <span>Mono</span>
          <span>Stereo</span>
        </CorrelationLabel>
        <CorrelationValue correlation={correlation}>
          {correlation.toFixed(2)}
          {correlation < -0.5 && ' (Phase Issues)'}
          {correlation > 0.8 && ' (Good Stereo)'}
        </CorrelationValue>
      </div>

      {/* Fast A/B Safety Panel */}
      <SafetyPanel>
        <SafetyPanelTitle>Fast A/B Safety</SafetyPanelTitle>
        
        <ABControls>
          <ABButton 
            active={currentABState === 'A'} 
            onClick={() => handleABToggle('A')}
          >
            <span>A</span>
            {currentABState === 'A' && <span>●</span>}
          </ABButton>
          
          <ABButton 
            active={currentABState === 'B'} 
            onClick={() => handleABToggle('B')}
          >
            <span>B</span>
            {currentABState === 'B' && <span>●</span>}
          </ABButton>
          
          <ABButton 
            danger 
            onClick={handlePanic}
            title="Emergency bypass all processing"
          >
            <span>🚨</span>
            PANIC
          </ABButton>
        </ABControls>

        {safetyMetrics && (
          <SafetyMetrics>
            <SafetyMetric status={getSafetyStatus(safetyMetrics.peak, 'peak')}>
              <div className="label">Peak</div>
              <div className="value">{safetyMetrics.peak.toFixed(1)}dB</div>
            </SafetyMetric>
            
            <SafetyMetric status={getSafetyStatus(safetyMetrics.lufs, 'lufs')}>
              <div className="label">LUFS</div>
              <div className="value">{safetyMetrics.lufs.toFixed(1)}</div>
            </SafetyMetric>
            
            <SafetyMetric status={getSafetyStatus(safetyMetrics.correlation, 'correlation')}>
              <div className="label">Corr</div>
              <div className="value">{safetyMetrics.correlation.toFixed(2)}</div>
            </SafetyMetric>
            
            <SafetyMetric status={getSafetyStatus(safetyMetrics.monoCompatibility, 'mono')}>
              <div className="label">Mono</div>
              <div className="value">{safetyMetrics.monoCompatibility.toFixed(0)}%</div>
            </SafetyMetric>
          </SafetyMetrics>
        )}
      </SafetyPanel>
    </VectorscopeContainer>
  );
};

export default Vectorscope;