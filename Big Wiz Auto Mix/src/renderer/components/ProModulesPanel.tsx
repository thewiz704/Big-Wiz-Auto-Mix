import React, { useState, useEffect, useRef } from 'react';
import { TransientShaper, HarmonicExciter } from '../../shared/proAudioModules';
import './ProModulesPanel.css';

interface ProModulesPanelProps {
  audioContext: AudioContext;
  inputNode?: AudioNode;
  outputNode?: AudioNode;
  onProcessingUpdate?: (data: any) => void;
}

export const ProModulesPanel: React.FC<ProModulesPanelProps> = ({
  audioContext,
  inputNode,
  outputNode,
  onProcessingUpdate
}) => {
  const [transientShaper] = useState(() => new TransientShaper(audioContext));
  const [harmonicExciter] = useState(() => new HarmonicExciter(audioContext));
  
  const [tsEnabled, setTsEnabled] = useState(false);
  const [heEnabled, setHeEnabled] = useState(false);
  
  const [tsParams, setTsParams] = useState({
    attack: 0,
    sustain: 0,
    frequency: 1000,
    sensitivity: 50,
    lookahead: 5,
    mix: 100
  });
  
  const [heParams, setHeParams] = useState({
    lowDrive: 0,
    lowHarmonics: 'even',
    midDrive: 0,
    midHarmonics: 'odd',
    highDrive: 0,
    highHarmonics: 'even',
    lowFreq: 300,
    highFreq: 3000,
    character: 'tube',
    mix: 25
  });

  const [analysisData, setAnalysisData] = useState({
    transient: {
      transientActivity: 0,
      attackGainReduction: 0,
      sustainGainReduction: 0,
      frequency: 1000
    },
    harmonic: {
      lowHarmonics: 0,
      midHarmonics: 0,
      highHarmonics: 0,
      totalHarmonicContent: 0
    }
  });

  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Connect audio nodes if provided
    if (inputNode && outputNode) {
      let currentNode = inputNode;
      
      if (tsEnabled) {
        currentNode.connect(transientShaper.getInputNode());
        currentNode = transientShaper.getOutputNode();
      }
      
      if (heEnabled) {
        currentNode.connect(harmonicExciter.getInputNode());
        currentNode = harmonicExciter.getOutputNode();
      }
      
      currentNode.connect(outputNode);
    }

    // Start analysis updates
    updateInterval.current = setInterval(() => {
      const newAnalysisData = {
        transient: transientShaper.getAnalysisData(),
        harmonic: harmonicExciter.getAnalysisData()
      };
      
      setAnalysisData(newAnalysisData);
      
      if (onProcessingUpdate) {
        onProcessingUpdate(newAnalysisData);
      }
    }, 100);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [tsEnabled, heEnabled, inputNode, outputNode]);

  const handleTsParameterChange = (param: keyof typeof tsParams, value: number | string) => {
    setTsParams(prev => ({ ...prev, [param]: value }));
    transientShaper.setParameter(param, value as number);
  };

  const handleHeParameterChange = (param: keyof typeof heParams, value: number | string) => {
    setHeParams(prev => ({ ...prev, [param]: value }));
    harmonicExciter.setParameter(param, value);
  };

  const renderTransientShaper = () => (
    <div className="pro-module">
      <div className="module-header">
        <button 
          className={`module-power ${tsEnabled ? 'on' : 'off'}`}
          onClick={() => setTsEnabled(!tsEnabled)}
        >
          ⏻
        </button>
        <h3>Transient Shaper</h3>
        <div className="module-status">
          <div className="activity-meter">
            <div 
              className="meter-fill"
              style={{ 
                height: `${analysisData.transient.transientActivity * 100}%`,
                backgroundColor: '#4ade80'
              }}
            />
          </div>
        </div>
      </div>

      <div className="module-content">
        <div className="parameter-grid">
          <div className="parameter-group">
            <h4>Transient Control</h4>
            
            <div className="parameter-control">
              <label>
                Attack
                <span className="value">{tsParams.attack > 0 ? '+' : ''}{tsParams.attack}%</span>
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                value={tsParams.attack}
                onChange={(e) => handleTsParameterChange('attack', parseInt(e.target.value))}
                className="slider attack"
              />
              <div className="parameter-description">
                Enhance (+) or reduce (-) attack transients
              </div>
            </div>

            <div className="parameter-control">
              <label>
                Sustain
                <span className="value">{tsParams.sustain > 0 ? '+' : ''}{tsParams.sustain}%</span>
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                value={tsParams.sustain}
                onChange={(e) => handleTsParameterChange('sustain', parseInt(e.target.value))}
                className="slider sustain"
              />
              <div className="parameter-description">
                Enhance (+) or reduce (-) sustain portions
              </div>
            </div>
          </div>

          <div className="parameter-group">
            <h4>Detection</h4>
            
            <div className="parameter-control">
              <label>
                Frequency
                <span className="value">{tsParams.frequency}Hz</span>
              </label>
              <input
                type="range"
                min={20}
                max={20000}
                value={tsParams.frequency}
                onChange={(e) => handleTsParameterChange('frequency', parseInt(e.target.value))}
                className="slider"
              />
              <div className="parameter-description">
                Focus frequency for transient detection
              </div>
            </div>

            <div className="parameter-control">
              <label>
                Sensitivity
                <span className="value">{tsParams.sensitivity}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={tsParams.sensitivity}
                onChange={(e) => handleTsParameterChange('sensitivity', parseInt(e.target.value))}
                className="slider"
              />
            </div>

            <div className="parameter-control">
              <label>
                Lookahead
                <span className="value">{tsParams.lookahead}ms</span>
              </label>
              <input
                type="range"
                min={0}
                max={20}
                value={tsParams.lookahead}
                onChange={(e) => handleTsParameterChange('lookahead', parseInt(e.target.value))}
                className="slider"
              />
            </div>

            <div className="parameter-control">
              <label>
                Mix
                <span className="value">{tsParams.mix}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={tsParams.mix}
                onChange={(e) => handleTsParameterChange('mix', parseInt(e.target.value))}
                className="slider"
              />
            </div>
          </div>
        </div>

        <div className="analysis-display">
          <div className="meter-group">
            <div className="meter-label">Attack GR</div>
            <div className="gain-reduction-meter">
              <div 
                className="meter-fill attack"
                style={{ width: `${analysisData.transient.attackGainReduction}%` }}
              />
            </div>
            <span className="meter-value">{analysisData.transient.attackGainReduction.toFixed(1)}%</span>
          </div>
          
          <div className="meter-group">
            <div className="meter-label">Sustain GR</div>
            <div className="gain-reduction-meter">
              <div 
                className="meter-fill sustain"
                style={{ width: `${analysisData.transient.sustainGainReduction}%` }}
              />
            </div>
            <span className="meter-value">{analysisData.transient.sustainGainReduction.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHarmonicExciter = () => (
    <div className="pro-module">
      <div className="module-header">
        <button 
          className={`module-power ${heEnabled ? 'on' : 'off'}`}
          onClick={() => setHeEnabled(!heEnabled)}
        >
          ⏻
        </button>
        <h3>Harmonic Exciter</h3>
        <div className="harmonic-content-display">
          <span>THD: {(analysisData.harmonic.totalHarmonicContent * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div className="module-content">
        <div className="parameter-grid three-band">
          <div className="band-group low-band">
            <h4>Low Band</h4>
            
            <div className="parameter-control">
              <label>
                Drive
                <span className="value">{heParams.lowDrive}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={heParams.lowDrive}
                onChange={(e) => handleHeParameterChange('lowDrive', parseInt(e.target.value))}
                className="slider low"
              />
            </div>

            <div className="parameter-control">
              <label>Harmonics</label>
              <select
                value={heParams.lowHarmonics}
                onChange={(e) => handleHeParameterChange('lowHarmonics', e.target.value)}
                className="select"
              >
                <option value="even">Even</option>
                <option value="odd">Odd</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="harmonic-meter">
              <div 
                className="meter-fill low"
                style={{ height: `${analysisData.harmonic.lowHarmonics * 100}%` }}
              />
            </div>
          </div>

          <div className="band-group mid-band">
            <h4>Mid Band</h4>
            
            <div className="parameter-control">
              <label>
                Drive
                <span className="value">{heParams.midDrive}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={heParams.midDrive}
                onChange={(e) => handleHeParameterChange('midDrive', parseInt(e.target.value))}
                className="slider mid"
              />
            </div>

            <div className="parameter-control">
              <label>Harmonics</label>
              <select
                value={heParams.midHarmonics}
                onChange={(e) => handleHeParameterChange('midHarmonics', e.target.value)}
                className="select"
              >
                <option value="even">Even</option>
                <option value="odd">Odd</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="harmonic-meter">
              <div 
                className="meter-fill mid"
                style={{ height: `${analysisData.harmonic.midHarmonics * 100}%` }}
              />
            </div>
          </div>

          <div className="band-group high-band">
            <h4>High Band</h4>
            
            <div className="parameter-control">
              <label>
                Drive
                <span className="value">{heParams.highDrive}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={heParams.highDrive}
                onChange={(e) => handleHeParameterChange('highDrive', parseInt(e.target.value))}
                className="slider high"
              />
            </div>

            <div className="parameter-control">
              <label>Harmonics</label>
              <select
                value={heParams.highHarmonics}
                onChange={(e) => handleHeParameterChange('highHarmonics', e.target.value)}
                className="select"
              >
                <option value="even">Even</option>
                <option value="odd">Odd</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="harmonic-meter">
              <div 
                className="meter-fill high"
                style={{ height: `${analysisData.harmonic.highHarmonics * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="global-controls">
          <div className="parameter-group">
            <h4>Global Settings</h4>
            
            <div className="crossover-controls">
              <div className="parameter-control">
                <label>
                  Low/Mid
                  <span className="value">{heParams.lowFreq}Hz</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={1000}
                  value={heParams.lowFreq}
                  onChange={(e) => handleHeParameterChange('lowFreq', parseInt(e.target.value))}
                  className="slider"
                />
              </div>

              <div className="parameter-control">
                <label>
                  Mid/High
                  <span className="value">{heParams.highFreq}Hz</span>
                </label>
                <input
                  type="range"
                  min={1000}
                  max={10000}
                  value={heParams.highFreq}
                  onChange={(e) => handleHeParameterChange('highFreq', parseInt(e.target.value))}
                  className="slider"
                />
              </div>
            </div>

            <div className="character-select">
              <label>Character</label>
              <select
                value={heParams.character}
                onChange={(e) => handleHeParameterChange('character', e.target.value)}
                className="select character"
              >
                <option value="tube">Tube</option>
                <option value="tape">Tape</option>
                <option value="transistor">Transistor</option>
                <option value="digital">Digital</option>
              </select>
            </div>

            <div className="parameter-control">
              <label>
                Mix
                <span className="value">{heParams.mix}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={heParams.mix}
                onChange={(e) => handleHeParameterChange('mix', parseInt(e.target.value))}
                className="slider"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pro-modules-panel">
      <div className="panel-header">
        <h2>Pro Audio Modules</h2>
        <div className="panel-description">
          Professional transient shaping and harmonic enhancement
        </div>
      </div>

      <div className="modules-container">
        {renderTransientShaper()}
        {renderHarmonicExciter()}
      </div>
    </div>
  );
};