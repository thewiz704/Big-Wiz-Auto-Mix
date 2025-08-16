import React, { useState, useEffect } from 'react';
import { SuggestionEngine } from '../../shared/suggestionEngine';
import { ProcessingSuggestion, ModuleType } from '../../shared/processingChain';
import { ProcessingChainManager } from '../../shared/processingChainManager';
import { StemFile } from '../../shared/types';
import './SuggestionPanel.css';

interface SuggestionPanelProps {
  audioContext: AudioContext;
  chainManager: ProcessingChainManager;
  stems: StemFile[];
  onSuggestionApplied?: (suggestion: ProcessingSuggestion) => void;
}

export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({
  audioContext,
  chainManager,
  stems,
  onSuggestionApplied
}) => {
  const [suggestionEngine] = useState(() => new SuggestionEngine(audioContext));
  const [suggestions, setSuggestions] = useState<ProcessingSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('pop');
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [showApplied, setShowApplied] = useState(false);

  const genres = [
    { value: 'pop', label: 'Pop' },
    { value: 'rock', label: 'Rock' },
    { value: 'hip-hop', label: 'Hip-Hop' },
    { value: 'electronic', label: 'Electronic' },
    { value: 'jazz', label: 'Jazz' },
    { value: 'country', label: 'Country' },
    { value: 'r&b', label: 'R&B' },
    { value: 'classical', label: 'Classical' }
  ];

  const analyzeAndSuggest = async () => {
    if (stems.length === 0) return;

    setIsAnalyzing(true);
    try {
      // Get current analysis data
      const analysisFeatures = chainManager.getAnalysisFeatures();
      
      // Prepare stem data (mock audio buffers for now)
      const stemData = stems.map(stem => ({
        id: stem.id,
        role: stem.role,
        buffer: createMockAudioBuffer(audioContext) // In real implementation, get actual buffer
      }));

      // Run analysis
      const newSuggestions = await suggestionEngine.analyzeAndSuggest(
        stemData,
        analysisFeatures.spectrum,
        analysisFeatures.lufs,
        selectedGenre
      );

      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = (suggestion: ProcessingSuggestion) => {
    try {
      // Apply suggestion parameters to the processing chain
      Object.entries(suggestion.parameters).forEach(([paramName, value]) => {
        if (typeof value === 'string') {
          chainManager.setModuleParameter(suggestion.moduleType, paramName, value);
        } else {
          chainManager.setModuleParameter(suggestion.moduleType, paramName, value);
        }
      });

      // Mark as applied
      const suggestionId = getSuggestionId(suggestion);
      setAppliedSuggestions(prev => new Set([...prev, suggestionId]));

      if (onSuggestionApplied) {
        onSuggestionApplied(suggestion);
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  const unpackSuggestion = (suggestion: ProcessingSuggestion) => {
    // Show detailed breakdown of what the suggestion does
    const details = {
      module: getModuleDisplayName(suggestion.moduleType),
      parameters: suggestion.parameters,
      reasoning: suggestion.reasoning,
      confidence: suggestion.confidence
    };

    // You could show this in a modal or expanded view
    console.log('Suggestion details:', details);
  };

  const getSuggestionId = (suggestion: ProcessingSuggestion): string => {
    return `${suggestion.moduleType}-${suggestion.description}`;
  };

  const getModuleDisplayName = (moduleType: ModuleType): string => {
    const names: Record<ModuleType, string> = {
      [ModuleType.HPF]: 'High Pass Filter',
      [ModuleType.EQ]: 'EQ',
      [ModuleType.COMPRESSOR]: 'Compressor',
      [ModuleType.SATURATOR]: 'Saturator',
      [ModuleType.STEREO_WIDTH]: 'Stereo Width',
      [ModuleType.LIMITER]: 'Limiter',
      [ModuleType.TRANSIENT_SHAPER]: 'Transient Shaper',
      [ModuleType.HARMONIC_EXCITER]: 'Harmonic Exciter'
    };
    return names[moduleType] || moduleType;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return '#4ade80';
    if (confidence > 0.6) return '#fbbf24';
    if (confidence > 0.4) return '#f97316';
    return '#ef4444';
  };

  const getSuggestionIcon = (moduleType: ModuleType): string => {
    const icons: Record<ModuleType, string> = {
      [ModuleType.HPF]: '🔇',
      [ModuleType.EQ]: '📊',
      [ModuleType.COMPRESSOR]: '🗜️',
      [ModuleType.SATURATOR]: '🔥',
      [ModuleType.STEREO_WIDTH]: '〰️',
      [ModuleType.LIMITER]: '🚧',
      [ModuleType.TRANSIENT_SHAPER]: '⚡',
      [ModuleType.HARMONIC_EXCITER]: '✨'
    };
    return icons[moduleType] || '⚙️';
  };

  const filteredSuggestions = showApplied 
    ? suggestions 
    : suggestions.filter(s => !appliedSuggestions.has(getSuggestionId(s)));

  return (
    <div className="suggestion-panel">
      <div className="panel-header">
        <h3>AI Assistant</h3>
        <div className="analysis-controls">
          <select 
            value={selectedGenre} 
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="genre-select"
          >
            {genres.map(genre => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
          
          <button 
            className="analyze-button"
            onClick={analyzeAndSuggest}
            disabled={isAnalyzing || stems.length === 0}
          >
            {isAnalyzing ? (
              <>
                <span className="spinner">⏳</span>
                Analyzing...
              </>
            ) : (
              <>
                <span className="icon">🔍</span>
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      <div className="suggestions-container">
        <div className="suggestions-header">
          <div className="suggestions-count">
            {filteredSuggestions.length} suggestions
          </div>
          
          <div className="view-controls">
            <label className="show-applied">
              <input
                type="checkbox"
                checked={showApplied}
                onChange={(e) => setShowApplied(e.target.checked)}
              />
              Show Applied
            </label>
          </div>
        </div>

        <div className="suggestions-list">
          {filteredSuggestions.length === 0 ? (
            <div className="empty-state">
              {suggestions.length === 0 ? (
                <div>
                  <span className="empty-icon">🎯</span>
                  <p>Click "Analyze" to get AI-powered mixing suggestions</p>
                </div>
              ) : (
                <div>
                  <span className="empty-icon">✅</span>
                  <p>All suggestions have been applied!</p>
                </div>
              )}
            </div>
          ) : (
            filteredSuggestions.map((suggestion, index) => {
              const suggestionId = getSuggestionId(suggestion);
              const isApplied = appliedSuggestions.has(suggestionId);
              
              return (
                <div 
                  key={`${suggestionId}-${index}`}
                  className={`suggestion-card ${isApplied ? 'applied' : ''}`}
                >
                  <div className="suggestion-header">
                    <div className="suggestion-icon">
                      {getSuggestionIcon(suggestion.moduleType)}
                    </div>
                    
                    <div className="suggestion-info">
                      <div className="suggestion-title">
                        {suggestion.description}
                      </div>
                      <div className="suggestion-module">
                        {getModuleDisplayName(suggestion.moduleType)}
                      </div>
                    </div>
                    
                    <div className="confidence-badge">
                      <div 
                        className="confidence-bar"
                        style={{ 
                          backgroundColor: getConfidenceColor(suggestion.confidence),
                          width: `${suggestion.confidence * 100}%`
                        }}
                      />
                      <span className="confidence-text">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="suggestion-reasoning">
                    {suggestion.reasoning}
                  </div>

                  <div className="suggestion-actions">
                    <button
                      className="unpack-button"
                      onClick={() => unpackSuggestion(suggestion)}
                      title="Show detailed breakdown"
                    >
                      📋 Unpack
                    </button>
                    
                    <button
                      className={`apply-button ${isApplied ? 'applied' : ''}`}
                      onClick={() => applySuggestion(suggestion)}
                      disabled={isApplied}
                    >
                      {isApplied ? (
                        <>
                          <span>✅</span>
                          Applied
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          Apply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="panel-footer">
          <div className="stats">
            <span>{appliedSuggestions.size} applied</span>
            <span>{suggestions.length - appliedSuggestions.size} remaining</span>
          </div>
          
          <button 
            className="apply-all-button"
            onClick={() => {
              filteredSuggestions.forEach(applySuggestion);
            }}
            disabled={filteredSuggestions.length === 0}
          >
            Apply All ({filteredSuggestions.length})
          </button>
        </div>
      )}
    </div>
  );
};

// Helper function to create mock audio buffer
function createMockAudioBuffer(audioContext: AudioContext): AudioBuffer {
  const buffer = audioContext.createBuffer(2, audioContext.sampleRate * 2, audioContext.sampleRate);
  
  // Fill with some mock data
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (Math.random() - 0.5) * 0.1; // Quiet noise
    }
  }
  
  return buffer;
}