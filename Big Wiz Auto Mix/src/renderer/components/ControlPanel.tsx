import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { MixerSettings, PresetProfile, StemFile, AnalysisData, StemRole } from '../../shared/types';
import { MixReportGenerator } from '../../shared/mixReportGenerator';
import AnalyzeStemsPanel from './AnalyzeStemsPanel';
import QuickStartPanel from './QuickStartPanel';
import { StemAnalysisResult } from '../../shared/stemAnalysis';
import { PreviewEngine, PreviewState } from '../../shared/previewEngine';
import { MacroProcessor } from '../../shared/macroProcessor';

const ControlPanelContainer = styled.div`
  width: 360px;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border-left: 1px solid #444;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const Section = styled.div`
  padding: 16px;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
`;

const PresetButton = styled.button<{ active: boolean }>`
  padding: 12px 8px;
  background: ${props => props.active ? '#0078d4' : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${props => props.active ? '#106ebe' : '#555'};
  border-radius: 2px;
  color: ${props => props.active ? '#ffffff' : '#ccc'};
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
  
  &:hover {
    background: ${props => props.active ? '#106ebe' : 'rgba(255, 255, 255, 0.1)'};
    border-color: #0078d4;
    color: #ffffff;
  }
`;

const MacroSliders = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MacroHint = styled.div<{ value: number }>`
  font-size: 9px;
  color: ${props => {
    if (props.value < 20) return '#666';
    if (props.value < 40) return '#4a9eff';
    if (props.value < 70) return '#ffa502';
    return '#2ed573';
  }};
  text-align: center;
  margin-top: 2px;
  min-height: 12px;
  font-style: italic;
`;

const SliderValue = styled.span`
  color: #4a9eff;
  font-weight: 600;
`;

const SliderTrack = styled.div`
  height: 4px;
  background: #333;
  border-radius: 2px;
  position: relative;
  cursor: pointer;
`;

const SliderFill = styled.div<{ width: number }>`
  height: 100%;
  width: ${props => props.width}%;
  background: linear-gradient(90deg, #4a9eff 0%, #5aafff 100%);
  border-radius: 2px;
  transition: width 0.1s ease;
`;

const SliderHandle = styled.div<{ position: number }>`
  position: absolute;
  top: 50%;
  left: ${props => props.position}%;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border: 2px solid #4a9eff;
  border-radius: 50%;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: left 0.1s ease;
  
  &:hover {
    background: #f0f0f0;
    transform: translate(-50%, -50%) scale(1.1);
  }
`;

const TargetControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
`;

const TargetGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #444;
  border-radius: 6px;
`;

const TargetLabel = styled.div`
  font-size: 11px;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TargetInput = styled.input`
  background: #333;
  border: 1px solid #555;
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  width: 60px;
  text-align: center;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
`;

const LogSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 200px;
`;

const LogContainer = styled.div`
  flex: 1;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: #999;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
`;

const LogEntry = styled.div<{ type: 'info' | 'warning' | 'error' }>`
  margin-bottom: 4px;
  color: ${props => {
    switch (props.type) {
      case 'error': return '#ff4757';
      case 'warning': return '#ffa502';
      default: return '#4a9eff';
    }
  }};
`;

interface ControlPanelProps {
  mixerSettings: MixerSettings;
  setMixerSettings: React.Dispatch<React.SetStateAction<MixerSettings>>;
  stems?: StemFile[];
  analysisData?: AnalysisData;
  projectName?: string;
  audioContext?: AudioContext;
  onStemRoleUpdate?: (stemId: string, newRole: StemRole) => void;
  updateStem?: (id: string, updates: Partial<StemFile>) => void;
}

const intentPresets: PresetProfile[] = [
  { id: '1', name: 'Vocal Up', description: 'Enhanced vocal presence/wetness', settings: { previewLUFS: -18, streamLUFS: -14, peakCeiling: -1, punch: 40, warmth: 85, clarity: 70, air: 90, width: 30, reverb: 60 } },
  { id: '2', name: 'Warm & Wide', description: 'Fuller, wider sound', settings: { previewLUFS: -18, streamLUFS: -14, peakCeiling: -1, punch: 30, warmth: 90, clarity: 40, air: 70, width: 95, reverb: 50 } },
  { id: '3', name: 'Club-Ready', description: 'Punchy for dance floors', settings: { previewLUFS: -16, streamLUFS: -12, peakCeiling: -0.5, punch: 100, warmth: 40, clarity: 60, air: 60, width: 70, reverb: 30 } },
  { id: '4', name: 'Vintage Glue', description: 'Cohesive retro character', settings: { previewLUFS: -19, streamLUFS: -15, peakCeiling: -1.5, punch: 60, warmth: 100, clarity: 30, air: 40, width: 60, reverb: 70 } },
  { id: '5', name: 'Podcast Clarity', description: 'Clear, focused dialogue', settings: { previewLUFS: -19, streamLUFS: -16, peakCeiling: -2, punch: 50, warmth: 80, clarity: 95, air: 85, width: 20, reverb: 15 } },
  { id: '6', name: 'Beat Showcase', description: 'Highlight rhythmic elements', settings: { previewLUFS: -17, streamLUFS: -13, peakCeiling: -1, punch: 95, warmth: 35, clarity: 50, air: 50, width: 80, reverb: 25 } },
];

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  mixerSettings, 
  setMixerSettings, 
  stems = [], 
  analysisData = { spectrum: [], vectorscope: [], lufs: -23, peak: -6 },
  projectName = 'Untitled Project',
  audioContext,
  onStemRoleUpdate,
  updateStem
}) => {
  const [activePreset, setActivePreset] = useState<string>('');
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<StemAnalysisResult[]>([]);
  const [previewState, setPreviewState] = useState<PreviewState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    gainMatchEnabled: false,
    referenceGain: 0
  });
  const [gainMatchEnabled, setGainMatchEnabled] = useState(false);
  const [referenceSettings, setReferenceSettings] = useState<MixerSettings | null>(null);
  const previewEngine = useRef<PreviewEngine | null>(null);
  const [logEntries] = useState([
    { type: 'info' as const, message: 'Auto-mix engine initialized' },
    { type: 'info' as const, message: 'Analyzing stem frequencies...' },
    { type: 'warning' as const, message: 'Bass stem detected clipping at 2:34' },
    { type: 'info' as const, message: 'Applied EQ curve to lead synth' },
    { type: 'info' as const, message: 'Stereo width optimized for streaming' },
    { type: 'info' as const, message: 'Compressor applied to drums' },
    { type: 'warning' as const, message: 'High frequency content detected in vocal' },
    { type: 'info' as const, message: 'Reverb added to pad stems' },
    { type: 'info' as const, message: 'Master limiter engaged' },
    { type: 'info' as const, message: 'LUFS target achieved: -14.2 LUFS' },
    { type: 'error' as const, message: 'Peak limiting exceeded on channel 3' },
    { type: 'info' as const, message: 'Auto-mix process completed' },
  ]);

  // Initialize preview engine
  useEffect(() => {
    if (audioContext && !previewEngine.current) {
      previewEngine.current = new PreviewEngine(audioContext);
      
      // Load stems if available
      if (stems.length > 0) {
        previewEngine.current.loadStems(stems).catch(console.error);
      }
    }

    return () => {
      if (previewEngine.current) {
        previewEngine.current.dispose();
      }
    };
  }, [audioContext]);

  // Update preview when stems change
  useEffect(() => {
    if (previewEngine.current && stems.length > 0) {
      previewEngine.current.loadStems(stems).catch(console.error);
    }
  }, [stems]);

  const handlePresetSelect = (preset: PresetProfile) => {
    setActivePreset(preset.id);
    setMixerSettings(preset.settings);
    
    // Log the preset changes with deltas
    const presetDeltas = MacroProcessor.createPresetDeltas(preset.name);
    console.log(`Applied preset "${preset.name}" with deltas:`, presetDeltas);
    
    // Update preview with new settings
    if (previewEngine.current) {
      previewEngine.current.updateSettings(preset.settings, stems);
    }
  };

  const handleSliderChange = (key: keyof MixerSettings, value: number) => {
    const newSettings = { ...mixerSettings, [key]: value };
    setMixerSettings(newSettings);
    setActivePreset(''); // Clear active preset when manually adjusting
    
    // Real-time preview update
    if (previewEngine.current) {
      previewEngine.current.updateSettings(newSettings, stems);
    }
  };

  const handleQuickStartSettingsChange = (newSettings: MixerSettings) => {
    setMixerSettings(newSettings);
    setActivePreset(''); // Clear legacy preset when using Quick-Start
    
    // Real-time preview update for Quick-Start presets
    if (previewEngine.current) {
      previewEngine.current.updateSettings(newSettings, stems);
      console.log('Quick-Start settings applied to preview engine');
    }
  };

  const handleSliderMouseDown = (key: keyof MixerSettings, e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(key);
  };

  const handleSliderMouseMove = (e: MouseEvent, key: keyof MixerSettings, trackRect: DOMRect, min: number = 0, max: number = 100) => {
    if (isDragging !== key) return;
    
    const x = e.clientX - trackRect.left;
    const percentage = Math.max(0, Math.min(1, x / trackRect.width));
    const value = min + (percentage * (max - min));
    
    handleSliderChange(key, Math.round(value));
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const sliderTrack = document.querySelector(`[data-slider-key="${isDragging}"]`) as HTMLElement;
      if (sliderTrack) {
        const rect = sliderTrack.getBoundingClientRect();
        const key = isDragging as keyof MixerSettings;
        
        // Determine min/max based on the key
        const isLUFS = key.includes('LUFS') || key.includes('Ceiling');
        const min = isLUFS ? -40 : 0;
        const max = isLUFS ? 0 : 100;
        
        handleSliderMouseMove(e, key, rect, min, max);
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

  const getMusicalHint = (key: keyof MixerSettings, value: number): string => {
    switch (key) {
      case 'clarity':
        if (value < 20) return 'subtle high-shelf';
        if (value < 40) return '+2dB @ 8kHz presence';
        if (value < 70) return '+4dB shelf, -1dB mud cut';
        return 'aggressive +4dB shelf + mud reduction';
      case 'punch':
        if (value < 20) return 'light 1.5:1 bus comp';
        if (value < 40) return '1.8:1 comp, 20ms attack';
        if (value < 70) return '2:1 comp, faster attack';
        return '2.1:1 comp, 10ms attack, +3dB makeup';
      case 'warmth':
        if (value < 20) return 'slight low warmth';
        if (value < 40) return '+1dB low-shelf, tube character';
        if (value < 70) return '+2dB @ 160Hz, -2dB @ 4kHz';
        return 'full vintage: +2dB low, -3dB mid, tube sat';
      case 'width':
        if (value < 20) return 'narrow stereo field';
        if (value < 40) return 'subtle M/S widening';
        if (value < 70) return 'wide stereo, bass-mono safe';
        return '150% width, bass-mono protected';
      case 'air':
        if (value < 20) return 'natural high frequencies';
        if (value < 40) return '+1dB @ 14kHz shelf';
        if (value < 70) return '+2dB airy shelf';
        return '+3dB @ 14kHz high-shelf';
      case 'reverb':
        if (value < 20) return 'dry & intimate';
        if (value < 40) return 'room ambience send';
        if (value < 70) return 'hall space depth';
        return 'ethereal reverb depth';
      default:
        return '';
    }
  };

  const handleStemRoleUpdate = (stemId: string, newRole: StemRole, confidence: number) => {
    // Update the stem role in the local state if updateStem is available
    if (updateStem) {
      updateStem(stemId, { role: newRole });
    }
    
    // Notify parent component if callback is provided
    if (onStemRoleUpdate) {
      onStemRoleUpdate(stemId, newRole);
    }
    
    console.log(`Updated stem ${stemId} role to ${newRole} (confidence: ${(confidence * 100).toFixed(1)}%)`);
  };

  const handleAnalysisComplete = (results: StemAnalysisResult[]) => {
    setAnalysisResults(results);
    console.log('Stem analysis completed:', results);
    
    // Log detection results
    results.forEach(result => {
      console.log(`${result.stemId}: detected as ${result.detectedRole} (${(result.confidence * 100).toFixed(1)}% confidence)`);
    });
  };

  const handlePreviewPlay = async () => {
    if (!previewEngine.current) return;
    
    try {
      if (previewState.isPlaying) {
        previewEngine.current.pause();
      } else {
        await previewEngine.current.play(mixerSettings, stems);
      }
      
      // Update state
      const newState = previewEngine.current.getState();
      setPreviewState(newState);
    } catch (error) {
      console.error('Preview playback failed:', error);
    }
  };

  const handleGainMatchToggle = (enabled: boolean) => {
    setGainMatchEnabled(enabled);
    
    if (enabled && !referenceSettings) {
      // Set current settings as reference
      setReferenceSettings({ ...mixerSettings });
    }
    
    if (previewEngine.current) {
      previewEngine.current.setGainMatch(enabled, referenceSettings || undefined);
    }
    
    console.log(`Gain-match ${enabled ? 'enabled' : 'disabled'}`);
  };

  const generateMixReport = (format: 'txt' | 'json' = 'txt') => {
    const report = MixReportGenerator.generate(
      stems,
      mixerSettings,
      analysisData,
      projectName
    );
    
    MixReportGenerator.exportReport(report, format);
    
    console.log(`Mix report generated and exported as ${format.toUpperCase()}`);
  };

  const createSlider = (
    key: keyof MixerSettings,
    label: string,
    min: number = 0,
    max: number = 100,
    tooltip?: string
  ) => {
    const value = mixerSettings[key];
    const hint = getMusicalHint(key, value);
    
    return (
      <SliderContainer key={key}>
        <SliderLabel>
          <span title={tooltip}>{label} {tooltip && <span style={{ color: '#666', fontSize: '10px' }}>ⓘ</span>}</span>
          <SliderValue>{value}{key.includes('LUFS') || key.includes('Ceiling') ? '' : '%'}</SliderValue>
        </SliderLabel>
        <SliderTrack 
          data-slider-key={key}
          onMouseDown={(e) => handleSliderMouseDown(key, e)}
        >
          <SliderFill width={((value - min) / (max - min)) * 100} />
          <SliderHandle position={((value - min) / (max - min)) * 100} />
        </SliderTrack>
        <MacroHint value={value}>{hint}</MacroHint>
      </SliderContainer>
    );
  };

  return (
    <ControlPanelContainer>
      <div style={{ flexShrink: 0, overflowY: 'auto', maxHeight: '60%' }}>
        <Section>
          <QuickStartPanel
            currentSettings={mixerSettings}
            onSettingsChange={handleQuickStartSettingsChange}
            onPreviewPlay={handlePreviewPlay}
            isPlaying={previewState.isPlaying}
            gainMatchEnabled={gainMatchEnabled}
            onGainMatchToggle={handleGainMatchToggle}
          />
        </Section>

        <Section>
          <SectionTitle>Legacy Quick Starts</SectionTitle>
          <PresetGrid>
            {intentPresets.map(preset => (
              <PresetButton
                key={preset.id}
                active={activePreset === preset.id}
                onClick={() => handlePresetSelect(preset)}
                title={preset.description}
              >
                {preset.name}
              </PresetButton>
            ))}
          </PresetGrid>
        </Section>

        {/* Stem Analysis Section */}
        {audioContext && (
          <Section>
            <AnalyzeStemsPanel
              audioContext={audioContext}
              stems={stems.map(stem => ({
                id: stem.id,
                name: stem.name,
                buffer: undefined, // TODO: Add audio buffer to StemFile type
                currentRole: stem.role
              }))}
              onRoleUpdate={handleStemRoleUpdate}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </Section>
        )}

        <Section>
          <SectionTitle>Macro Controls</SectionTitle>
          <MacroSliders>
            {createSlider('clarity', 'Clarity', 0, 100, '+1-4dB high-shelf @ 6-10kHz, optional -1-2dB @ 300-400Hz')}
            {createSlider('punch', 'Punch', 0, 100, 'Bus comp 1.3-2:1, 10-30ms attack, auto makeup; faster for percussive')}
            {createSlider('warmth', 'Warmth', 0, 100, '-1-3dB @ 3-5kHz + 0.5-2dB low-shelf @ 120-200Hz + tube sat')}
            {createSlider('width', 'Width', 0, 100, 'M/S side gain (-50%…+50%); bass mono-safe guard')}
            {createSlider('air', 'Air', 0, 100, '+0.5-3dB shelf @ 12-16kHz; negative backs it off')}
            {createSlider('reverb', 'Space', 0, 100, 'Reverb send depth + space ambience')}
          </MacroSliders>
        </Section>

        <Section>
          <SectionTitle>Reference Track</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input 
                id="reference-track-input"
                type="file" 
                accept="audio/*,.wav,.mp3,.flac,.aiff,.m4a"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    console.log('Reference track loaded:', e.target.files[0].name);
                    // TODO: Load reference track for analysis
                  }
                }}
              />
              <PresetButton 
                active={false}
                onClick={() => document.getElementById('reference-track-input')?.click()}
                style={{ flex: 1, fontSize: '10px', padding: '6px 8px' }}
              >
                Choose File
              </PresetButton>
              <PresetButton 
                active={false}
                onClick={() => {
                  const input = document.getElementById('reference-track-input') as HTMLInputElement;
                  if (input) {
                    input.value = '';
                    console.log('Reference track cleared');
                  }
                }}
                style={{ fontSize: '10px', padding: '6px 8px', background: '#d13438', borderColor: '#b12b30' }}
              >
                Clear
              </PresetButton>
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: '#666', 
              textAlign: 'center',
              minHeight: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              No reference track loaded
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <PresetButton 
                active={false} 
                onClick={() => console.log('Auto-match reference')}
                style={{ flex: 1, fontSize: '10px', padding: '8px 4px' }}
              >
                Auto-Match
              </PresetButton>
              <PresetButton 
                active={false} 
                onClick={() => console.log('Show difference curve')}
                style={{ flex: 1, fontSize: '10px', padding: '8px 4px' }}
              >
                Diff Curve
              </PresetButton>
            </div>
            <div style={{ 
              height: '40px', 
              background: '#0a0a0a', 
              border: '1px solid #333',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#666'
            }}>
              Spectral difference visualization
            </div>
          </div>
        </Section>

        <Section>
          <SectionTitle>Target Controls</SectionTitle>
          <TargetControls>
            <TargetGroup>
              <TargetLabel>Preview LUFS</TargetLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TargetInput
                  type="number"
                  step="0.1"
                  value={mixerSettings.previewLUFS}
                  onChange={(e) => handleSliderChange('previewLUFS', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#666' }}>LUFS</span>
              </div>
            </TargetGroup>
            <TargetGroup>
              <TargetLabel>Stream LUFS</TargetLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TargetInput
                  type="number"
                  step="0.1"
                  value={mixerSettings.streamLUFS}
                  onChange={(e) => handleSliderChange('streamLUFS', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#666' }}>LUFS</span>
              </div>
            </TargetGroup>
            <TargetGroup>
              <TargetLabel>Peak Ceiling</TargetLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TargetInput
                  type="number"
                  step="0.1"
                  value={mixerSettings.peakCeiling}
                  onChange={(e) => handleSliderChange('peakCeiling', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '10px', color: '#666' }}>dBFS</span>
              </div>
            </TargetGroup>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#ccc', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  style={{ accentColor: '#4a9eff' }}
                  checked={gainMatchEnabled}
                  onChange={(e) => handleGainMatchToggle(e.target.checked)}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Gain-Match
                  <span style={{ color: '#666', fontSize: '10px' }} title="Fair A/B comparison by matching perceived loudness">ⓘ</span>
                </span>
              </label>
              <PresetButton 
                active={previewState.isPlaying}
                onClick={handlePreviewPlay}
                style={{ fontSize: '10px', padding: '6px 12px', marginLeft: 'auto' }}
                title="Preview changes with real audio processing"
              >
                {previewState.isPlaying ? '⏸ Stop' : '▶ Preview'}
              </PresetButton>
            </div>
          </TargetControls>
        </Section>
      </div>

      <Section>
        <SectionTitle>Safety & Export</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <PresetButton 
              active={false} 
              onClick={() => {
                console.log('Running ISP (Inter-Sample Peak) analysis...');
                // TODO: Implement true ISP detection with 4x oversampling
              }}
              title="Inter-Sample Peak detection with 4x oversampling"
            >
              ISP Check
            </PresetButton>
            <PresetButton 
              active={false} 
              onClick={() => {
                console.log('Scanning for DC offset...');
                // TODO: Implement DC offset detection and correction
              }}
              title="Detect and remove DC offset"
            >
              DC Fix
            </PresetButton>
            <PresetButton 
              active={false} 
              onClick={() => {
                console.log('Checking mono compatibility...');
                // TODO: Implement mono compatibility check (phase correlation)
              }}
              title="Check mono compatibility and phase correlation"
            >
              Mono Check
            </PresetButton>
            <PresetButton 
              active={false} 
              onClick={() => {
                console.log('Analyzing stereo phase relationships...');
                // TODO: Implement phase analysis across frequency spectrum
              }}
              title="Analyze phase relationships across frequency spectrum"
            >
              Phase Check
            </PresetButton>
          </div>
          
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '8px',
            marginTop: '8px'
          }}>
            <div style={{ fontSize: '11px', color: '#ccc', marginBottom: '6px' }}>Export Options</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#ccc' }}>
                <input type="radio" name="export" defaultChecked />
                PRINT Mix (High-res for mastering)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#ccc' }}>
                <input type="radio" name="export" />
                STREAM Mix (Optimized for platforms)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#ccc' }}>
                <input type="radio" name="export" />
                Export Stems (Multi-track)
              </label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                <select style={{ 
                  flex: 1, 
                  fontSize: '9px', 
                  background: '#333', 
                  color: '#ccc', 
                  border: '1px solid #555',
                  borderRadius: '2px',
                  padding: '2px 4px'
                }}>
                  <option value="wav32">WAV 32-bit Float</option>
                  <option value="wav24" selected>WAV 24-bit</option>
                  <option value="wav16">WAV 16-bit</option>
                  <option value="flac">FLAC 24-bit</option>
                  <option value="mp3">MP3 320kbps</option>
                  <option value="aiff24">AIFF 24-bit</option>
                </select>
                <PresetButton 
                  active={true} 
                  style={{ fontSize: '9px', padding: '4px 8px' }}
                  onClick={() => {
                    console.log('Exporting with selected format and settings...');
                    // Auto-generate mix report if checkbox is checked
                    const autoReportCheckbox = document.querySelector('input[type="checkbox"][id="auto-report"]') as HTMLInputElement;
                    if (autoReportCheckbox?.checked) {
                      generateMixReport('txt');
                    }
                    // TODO: Implement actual audio export functionality
                  }}
                >
                  Export
                </PresetButton>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', fontSize: '9px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#999' }}>
                  <input type="checkbox" style={{ transform: 'scale(0.8)' }} />
                  Bounce tails (+2s)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#999' }}>
                  <input 
                    type="checkbox" 
                    id="auto-report"
                    defaultChecked 
                    style={{ transform: 'scale(0.8)' }} 
                  />
                  Auto Mix Report
                </label>
                <PresetButton 
                  active={false}
                  style={{ fontSize: '8px', padding: '2px 6px', marginLeft: 'auto' }}
                  onClick={() => generateMixReport('txt')}
                  title="Generate detailed mix report with analysis and recommendations"
                >
                  Generate Report
                </PresetButton>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <LogSection>
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #444' }}>
          <SectionTitle style={{ margin: 0 }}>Processing Log</SectionTitle>
        </div>
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <LogContainer>
            {logEntries.map((entry, index) => (
              <LogEntry key={index} type={entry.type}>
                [{new Date().toLocaleTimeString()}] {entry.message}
              </LogEntry>
            ))}
          </LogContainer>
        </div>
      </LogSection>
    </ControlPanelContainer>
  );
};

export default ControlPanel;