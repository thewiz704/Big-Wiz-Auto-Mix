import React, { useState, useEffect, useRef } from 'react';
import { ProcessingChainManager } from '../../shared/processingChainManager';
import { ProcessingChain, ModuleType, TinyPreset } from '../../shared/processingChain';
import { TinyPresetsManager, getPresetsByModule } from '../../shared/tinyPresets';
import './ProcessingChain.css';

interface ProcessingChainProps {
  audioContext: AudioContext;
  onAnalysisUpdate?: (analysis: any) => void;
}

export const ProcessingChainComponent: React.FC<ProcessingChainProps> = ({ 
  audioContext, 
  onAnalysisUpdate 
}) => {
  const [chainManager] = useState(() => new ProcessingChainManager(audioContext));
  const [presetsManager] = useState(() => new TinyPresetsManager());
  const [chain, setChain] = useState<ProcessingChain | null>(null);
  const [activeModule, setActiveModule] = useState<string>('eq');
  const [showPresetMenu, setShowPresetMenu] = useState<string | null>(null);
  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    presetsManager.loadUserData();
    setChain(chainManager.getChainState());
    
    // Start analysis updates
    updateInterval.current = setInterval(() => {
      if (onAnalysisUpdate) {
        const analysis = chainManager.getAnalysisFeatures();
        onAnalysisUpdate(analysis);
      }
    }, 100);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [chainManager, presetsManager, onAnalysisUpdate]);

  const handleModuleToggle = (moduleId: string) => {
    chainManager.toggleModule(moduleId);
    setChain(chainManager.getChainState());
  };

  const handleParameterChange = (moduleId: string, paramName: string, value: unknown) => {
    chainManager.setModuleParameter(moduleId, paramName, value as number);
    setChain(chainManager.getChainState());
  };

  const handlePresetLoad = (moduleId: string, preset: TinyPreset) => {
    chainManager.loadTinyPreset(moduleId, preset);
    presetsManager.addToRecent(preset);
    setChain(chainManager.getChainState());
    setShowPresetMenu(null);
  };

  const handleSnapshotSave = (slotIndex: number) => {
    chainManager.saveSnapshot(slotIndex);
    setChain(chainManager.getChainState());
  };

  const handleSnapshotLoad = (slotIndex: number) => {
    chainManager.loadSnapshot(slotIndex);
    setChain(chainManager.getChainState());
  };

  if (!chain) return <div>Loading...</div>;

  return (
    <div className="processing-chain">
      {/* Global Controls */}
      <div className="chain-header">
        <div className="snapshots">
          {chain.globalSettings.snapshots.map((snapshot, index) => (
            <div key={snapshot.id} className="snapshot-group">
              <button 
                className={`snapshot-btn ${chain.globalSettings.currentSnapshot === index ? 'active' : ''}`}
                onClick={() => handleSnapshotLoad(index)}
              >
                {snapshot.name}
              </button>
              <button 
                className="snapshot-save"
                onClick={() => handleSnapshotSave(index)}
                title="Save current state"
              >
                💾
              </button>
            </div>
          ))}
        </div>
        
        <div className="global-controls">
          <label className="gain-match">
            <input 
              type="checkbox" 
              checked={chain.globalSettings.gainMatch}
              onChange={(e) => {
                // Update gain match setting
                chainManager.setModuleParameter('global', 'gainMatch', e.target.checked);
                setChain(chainManager.getChainState());
              }}
            />
            Gain Match
          </label>
        </div>
      </div>

      {/* Module Chain */}
      <div className="module-chain">
        {chain.modules.map((module, index) => (
          <div key={module.id} className="module-container">
            <ModuleBlock
              module={module}
              isActive={activeModule === module.id}
              onToggle={() => handleModuleToggle(module.id)}
              onSelect={() => setActiveModule(module.id)}
              onParameterChange={(paramName, value) => 
                handleParameterChange(module.id, paramName, value)
              }
              onPresetMenuToggle={() => 
                setShowPresetMenu(showPresetMenu === module.id ? null : module.id)
              }
              showPresetMenu={showPresetMenu === module.id}
              onPresetLoad={(preset) => handlePresetLoad(module.id, preset)}
              presetsManager={presetsManager}
            />
            {index < chain.modules.length - 1 && (
              <div className="chain-arrow">→</div>
            )}
          </div>
        ))}
      </div>

      {/* Detailed Controls */}
      <div className="module-details">
        {activeModule && (
          <ModuleDetailPanel
            module={chain.modules.find(m => m.id === activeModule)!}
            onParameterChange={(paramName, value) => 
              handleParameterChange(activeModule, paramName, value)
            }
            chainManager={chainManager}
          />
        )}
      </div>
    </div>
  );
};

interface ModuleBlockProps {
  module: any;
  isActive: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onParameterChange: (paramName: string, value: unknown) => void;
  onPresetMenuToggle: () => void;
  showPresetMenu: boolean;
  onPresetLoad: (preset: TinyPreset) => void;
  presetsManager: TinyPresetsManager;
}

const ModuleBlock: React.FC<ModuleBlockProps> = ({
  module,
  isActive,
  onToggle,
  onSelect,
  onParameterChange,
  onPresetMenuToggle,
  showPresetMenu,
  onPresetLoad,
  presetsManager
}) => {
  const moduleType = module.id as ModuleType;
  const presets = getPresetsByModule(moduleType);
  const favorites = presetsManager.getFavorites(moduleType);
  const recent = presetsManager.getRecentlyUsed();

  return (
    <div 
      className={`module-block ${module.enabled ? 'enabled' : 'disabled'} ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <div className="module-header">
        <button 
          className={`module-power ${module.enabled ? 'on' : 'off'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          ⏻
        </button>
        <span className="module-name">{module.name}</span>
        <button 
          className="preset-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPresetMenuToggle();
          }}
        >
          📋
        </button>
      </div>

      {module.preset && (
        <div className="current-preset">
          {module.preset.name}
        </div>
      )}

      {showPresetMenu && (
        <div className="preset-menu">
          {recent.length > 0 && (
            <div className="preset-category">
              <div className="category-header">Recent</div>
              {recent.slice(0, 3).map((preset, index) => (
                <button
                  key={`recent-${index}`}
                  className="preset-item"
                  onClick={() => onPresetLoad(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}

          {favorites.length > 0 && (
            <div className="preset-category">
              <div className="category-header">Favorites</div>
              {favorites.map((preset, index) => (
                <button
                  key={`favorite-${index}`}
                  className="preset-item favorite"
                  onClick={() => onPresetLoad(preset)}
                >
                  ⭐ {preset.name}
                </button>
              ))}
            </div>
          )}

          <div className="preset-category">
            <div className="category-header">Factory</div>
            {presets.map((preset, index) => (
              <button
                key={`factory-${index}`}
                className="preset-item"
                onClick={() => onPresetLoad(preset)}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ModuleDetailPanelProps {
  module: any;
  onParameterChange: (paramName: string, value: unknown) => void;
  chainManager: ProcessingChainManager;
}

const ModuleDetailPanel: React.FC<ModuleDetailPanelProps> = ({
  module,
  onParameterChange,
  chainManager
}) => {
  const renderParameterControl = (paramName: string, value: unknown) => {
    if (typeof value === 'boolean') {
      return (
        <label className="param-control boolean">
          <span>{paramName}</span>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onParameterChange(paramName, e.target.checked)}
          />
        </label>
      );
    }

    if (typeof value === 'number') {
      const getRange = (paramName: string) => {
        switch (paramName) {
          case 'frequency': return { min: 20, max: 20000, step: 1 };
          case 'gain': return { min: -24, max: 24, step: 0.1 };
          case 'threshold': return { min: -60, max: 0, step: 0.1 };
          case 'ratio': return { min: 1, max: 20, step: 0.1 };
          case 'attack': return { min: 0.1, max: 100, step: 0.1 };
          case 'release': return { min: 1, max: 1000, step: 1 };
          default: return { min: 0, max: 100, step: 1 };
        }
      };

      const range = getRange(paramName);
      
      return (
        <div className="param-control number">
          <label>{paramName}</label>
          <div className="number-input">
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onChange={(e) => onParameterChange(paramName, parseFloat(e.target.value))}
            />
            <input
              type="number"
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onChange={(e) => onParameterChange(paramName, parseFloat(e.target.value))}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="param-control string">
        <label>{paramName}</label>
        <select
          value={String(value)}
          onChange={(e) => onParameterChange(paramName, e.target.value)}
        >
          <option value={String(value)}>{String(value)}</option>
        </select>
      </div>
    );
  };

  return (
    <div className="module-detail-panel">
      <h3>{module.name} Controls</h3>
      <div className="parameter-grid">
        {Object.entries(module.parameters).map(([paramName, value]) => (
          <div key={paramName}>
            {renderParameterControl(paramName, value)}
          </div>
        ))}
      </div>

      {/* Special controls for EQ module */}
      {module.id === 'eq' && (
        <EQBandControls 
          module={module}
          chainManager={chainManager}
        />
      )}
    </div>
  );
};

interface EQBandControlsProps {
  module: any;
  chainManager: ProcessingChainManager;
}

const EQBandControls: React.FC<EQBandControlsProps> = ({ module, chainManager }) => {
  return (
    <div className="eq-band-controls">
      <h4>EQ Bands</h4>
      {module.bands?.map((band: any, index: number) => (
        <div key={band.id} className="eq-band">
          <div className="band-header">
            <button
              className={`band-power ${band.enabled ? 'on' : 'off'}`}
              onClick={() => chainManager.toggleEQBand(band.id)}
            >
              {band.enabled ? '●' : '○'}
            </button>
            <span>{band.id}</span>
            <button
              className={`dynamic-toggle ${band.isDynamic ? 'dynamic' : 'static'}`}
              onClick={() => chainManager.setEQBandDynamic(band.id, !band.isDynamic)}
            >
              {band.isDynamic ? 'DYN' : 'STAT'}
            </button>
            <select
              value={band.midSideMode}
              onChange={(e) => chainManager.setEQBandMidSide(band.id, e.target.value as any)}
            >
              <option value="stereo">L+R</option>
              <option value="mid">Mid</option>
              <option value="side">Side</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
};