import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const LUFSContainer = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const LUFSTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
`;

const MetersContainer = styled.div`
  display: flex;
  gap: 30px;
  align-items: center;
  flex: 1;
`;

const MeterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const MeterLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const MeterTrack = styled.div`
  width: 36px;
  height: 280px;
  background: #222;
  border: 2px solid #444;
  border-radius: 18px;
  position: relative;
  overflow: hidden;
`;

const MeterFill = styled.div<{ level: number; type: 'lufs' | 'peak' | 'crest' | 'short' | 'momentary' }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${props => Math.max(0, Math.min(100, props.level))}%;
  background: ${props => {
    if (props.type === 'peak') {
      return props.level > 90 ? 
        'linear-gradient(0deg, #ff4757 0%, #ff6b7a 50%, #ff8a9b 100%)' :
        props.level > 70 ? 
        'linear-gradient(0deg, #ffa502 0%, #ffb32d 50%, #ffc357 100%)' :
        'linear-gradient(0deg, #2ed573 0%, #7bed9f 50%, #70a1ff 100%)';
    } else if (props.type === 'crest') {
      return 'linear-gradient(0deg, #4a9eff 0%, #5aafff 50%, #7ac5ff 100%)';
    } else if (props.type === 'short') {
      return 'linear-gradient(0deg, #ff6b35 0%, #ff8c55 50%, #ffad75 100%)';
    } else if (props.type === 'momentary') {
      return 'linear-gradient(0deg, #a55eea 0%, #b370f0 50%, #c787f5 100%)';
    } else {
      return props.level > 80 ? 
        'linear-gradient(0deg, #ff4757 0%, #ff6b7a 50%, #ff8a9b 100%)' :
        props.level > 60 ? 
        'linear-gradient(0deg, #ffa502 0%, #ffb32d 50%, #ffc357 100%)' :
        'linear-gradient(0deg, #4a9eff 0%, #5aafff 50%, #7ac5ff 100%)';
    }
  }};
  border-radius: 0 0 16px 16px;
  transition: height 0.1s ease;
`;

const MeterScale = styled.div`
  position: absolute;
  right: -30px;
  top: 0;
  height: 100%;
  width: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
`;

const ScaleMark = styled.div`
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 50%;
    width: 6px;
    height: 1px;
    background: #666;
    transform: translateY(-50%);
  }
`;

const ValueDisplay = styled.div<{ inRange?: boolean }>`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.inRange === false ? '#ff4757' : props.inRange === true ? '#2ed573' : '#ffffff'};
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #444;
  min-width: 70px;
  text-align: center;
`;

const TargetLine = styled.div<{ position: number }>`
  position: absolute;
  left: -4px;
  right: -4px;
  height: 2px;
  background: #ff4757;
  top: ${props => 100 - props.position}%;
  transform: translateY(-50%);
  
  &::before {
    content: '';
    position: absolute;
    right: -8px;
    top: 50%;
    width: 0;
    height: 0;
    border-left: 4px solid #ff4757;
    border-top: 3px solid transparent;
    border-bottom: 3px solid transparent;
    transform: translateY(-50%);
  }
`;

const GainMatchSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 16px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const GainMatchButton = styled.button<{ active: boolean }>`
  padding: 8px 16px;
  background: ${props => props.active ? '#2ed573' : '#0078d4'};
  border: 1px solid ${props => props.active ? '#1cd863' : '#106ebe'};
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.active ? '#1cd863' : '#106ebe'};
  }
`;

const DeltaDisplay = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #ccc;
`;

const DeltaValue = styled.span<{ delta: number }>`
  color: ${props => Math.abs(props.delta) > 1 ? '#ffa502' : '#2ed573'};
  font-weight: 600;
`;

interface LUFSMeterProps {
  lufs: number;
  peak: number;
  targetLUFS?: number;
}

const LUFSMeter: React.FC<LUFSMeterProps> = ({ lufs, peak, targetLUFS = -14 }) => {
  const [gainMatching, setGainMatching] = useState(false);
  const [shortTerm, setShortTerm] = useState(lufs);
  const [momentary, setMomentary] = useState(lufs);
  
  // Calculate levels for display
  const lufsLevel = ((lufs + 60) / 60) * 100;
  const peakLevel = ((peak + 60) / 60) * 100;
  const shortLevel = ((shortTerm + 60) / 60) * 100;
  const momentaryLevel = ((momentary + 60) / 60) * 100;
  
  // Calculate crest factor and dynamics
  const crestFactor = peak - lufs;
  const crestLevel = Math.min(100, (crestFactor / 20) * 100); // 0-20dB range
  
  // Calculate deltas
  const lufsDeltas = lufs - targetLUFS;
  
  // Simulate short-term and momentary LUFS
  useEffect(() => {
    const interval = setInterval(() => {
      setShortTerm(lufs + (Math.random() - 0.5) * 2); // ±1 dB variation
      setMomentary(lufs + (Math.random() - 0.5) * 4); // ±2 dB variation
    }, 100);
    
    return () => clearInterval(interval);
  }, [lufs]);

  return (
    <LUFSContainer>
      <LUFSTitle>Integrated Loudness & Dynamics</LUFSTitle>
      
      <MetersContainer>
        <MeterContainer>
          <MeterLabel>Integrated</MeterLabel>
          <MeterTrack>
            <MeterFill level={lufsLevel} type="lufs" />
            <TargetLine position={((targetLUFS + 60) / 60) * 100} />
            <MeterScale>
              <ScaleMark>0</ScaleMark>
              <ScaleMark>-6</ScaleMark>
              <ScaleMark>-12</ScaleMark>
              <ScaleMark>-18</ScaleMark>
              <ScaleMark>-24</ScaleMark>
              <ScaleMark>-30</ScaleMark>
              <ScaleMark>-36</ScaleMark>
              <ScaleMark>-42</ScaleMark>
              <ScaleMark>-48</ScaleMark>
              <ScaleMark>-54</ScaleMark>
              <ScaleMark>-60</ScaleMark>
            </MeterScale>
          </MeterTrack>
          <ValueDisplay inRange={Math.abs(lufsDeltas) < 1}>{lufs.toFixed(1)} LUFS</ValueDisplay>
        </MeterContainer>

        <MeterContainer>
          <MeterLabel>Short-Term</MeterLabel>
          <MeterTrack>
            <MeterFill level={shortLevel} type="short" />
            <TargetLine position={((targetLUFS + 60) / 60) * 100} />
            <MeterScale>
              <ScaleMark>0</ScaleMark>
              <ScaleMark>-12</ScaleMark>
              <ScaleMark>-24</ScaleMark>
              <ScaleMark>-36</ScaleMark>
              <ScaleMark>-48</ScaleMark>
              <ScaleMark>-60</ScaleMark>
            </MeterScale>
          </MeterTrack>
          <ValueDisplay>{shortTerm.toFixed(1)} LUFS</ValueDisplay>
        </MeterContainer>

        <MeterContainer>
          <MeterLabel>Momentary</MeterLabel>
          <MeterTrack>
            <MeterFill level={momentaryLevel} type="momentary" />
            <TargetLine position={((targetLUFS + 60) / 60) * 100} />
            <MeterScale>
              <ScaleMark>0</ScaleMark>
              <ScaleMark>-12</ScaleMark>
              <ScaleMark>-24</ScaleMark>
              <ScaleMark>-36</ScaleMark>
              <ScaleMark>-48</ScaleMark>
              <ScaleMark>-60</ScaleMark>
            </MeterScale>
          </MeterTrack>
          <ValueDisplay>{momentary.toFixed(1)} LUFS</ValueDisplay>
        </MeterContainer>

        <MeterContainer>
          <MeterLabel>True Peak</MeterLabel>
          <MeterTrack>
            <MeterFill level={peakLevel} type="peak" />
            <TargetLine position={(((-1) + 60) / 60) * 100} />
            <MeterScale>
              <ScaleMark>0</ScaleMark>
              <ScaleMark>-6</ScaleMark>
              <ScaleMark>-12</ScaleMark>
              <ScaleMark>-18</ScaleMark>
              <ScaleMark>-24</ScaleMark>
              <ScaleMark>-30</ScaleMark>
            </MeterScale>
          </MeterTrack>
          <ValueDisplay inRange={peak < -0.1}>{peak.toFixed(1)} dB</ValueDisplay>
        </MeterContainer>

        <MeterContainer>
          <MeterLabel>Crest Factor</MeterLabel>
          <MeterTrack>
            <MeterFill level={crestLevel} type="crest" />
            <MeterScale>
              <ScaleMark>20</ScaleMark>
              <ScaleMark>15</ScaleMark>
              <ScaleMark>10</ScaleMark>
              <ScaleMark>5</ScaleMark>
              <ScaleMark>0</ScaleMark>
            </MeterScale>
          </MeterTrack>
          <ValueDisplay>{crestFactor.toFixed(1)} dB</ValueDisplay>
        </MeterContainer>
      </MetersContainer>

      <GainMatchSection>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
            Gain Matching
          </span>
          <GainMatchButton 
            active={gainMatching}
            onClick={() => setGainMatching(!gainMatching)}
          >
            {gainMatching ? 'Active' : 'Enable'}
          </GainMatchButton>
        </div>
        
        <DeltaDisplay>
          <span>Target: {targetLUFS} LUFS</span>
          <DeltaValue delta={lufsDeltas}>
            {lufsDeltas > 0 ? '+' : ''}{lufsDeltas.toFixed(1)} dB
          </DeltaValue>
        </DeltaDisplay>
        
        <DeltaDisplay>
          <span>Suggested Trim:</span>
          <DeltaValue delta={lufsDeltas}>
            {lufsDeltas > 0 ? '' : '+'}{(-lufsDeltas).toFixed(1)} dB
          </DeltaValue>
        </DeltaDisplay>
        
        <DeltaDisplay>
          <span>Crest Factor:</span>
          <span style={{ color: crestFactor > 15 ? '#2ed573' : crestFactor > 10 ? '#ffa502' : '#ff4757' }}>
            {crestFactor > 15 ? 'Dynamic' : crestFactor > 10 ? 'Balanced' : 'Over-compressed'}
          </span>
        </DeltaDisplay>
      </GainMatchSection>
    </LUFSContainer>
  );
};

export default LUFSMeter;