import React, { useState, useRef } from 'react';
import { StemAnalyzer, StemAnalysisResult } from '../../shared/stemAnalysis';
import { StemRole } from '../../shared/types';
import './AnalyzeStemsPanel.css';

interface AnalyzeStemsPanelProps {
  audioContext: AudioContext;
  stems: { id: string; name: string; buffer?: AudioBuffer; currentRole: StemRole }[];
  onRoleUpdate: (stemId: string, newRole: StemRole, confidence: number) => void;
  onAnalysisComplete?: (results: StemAnalysisResult[]) => void;
}

export const AnalyzeStemsPanel: React.FC<AnalyzeStemsPanelProps> = ({
  audioContext,
  stems,
  onRoleUpdate,
  onAnalysisComplete
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<StemAnalysisResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [revertData, setRevertData] = useState<{ stemId: string; originalRole: StemRole }[]>([]);
  const analyzerRef = useRef<StemAnalyzer | null>(null);

  const initializeAnalyzer = () => {
    if (!analyzerRef.current) {
      analyzerRef.current = new StemAnalyzer(audioContext);
    }
    return analyzerRef.current;
  };

  const handleAnalyzeStems = async () => {
    if (stems.length === 0 || !stems.some(s => s.buffer)) {
      alert('No audio stems loaded for analysis');
      return;
    }

    setIsAnalyzing(true);
    setShowResults(false);

    try {
      const analyzer = initializeAnalyzer();
      
      // Store original roles for revert functionality
      const originalRoles = stems.map(stem => ({
        stemId: stem.id,
        originalRole: stem.currentRole
      }));
      setRevertData(originalRoles);

      // Prepare stems with audio buffers
      const stemsWithBuffers = stems
        .filter(stem => stem.buffer)
        .map(stem => ({
          id: stem.id,
          buffer: stem.buffer!
        }));

      console.log(`Analyzing ${stemsWithBuffers.length} stems...`);
      
      // Perform analysis
      const results = await analyzer.analyzeStems(stemsWithBuffers);
      
      console.log('Analysis results:', results);
      setAnalysisResults(results);
      
      // Auto-update roles based on detection
      results.forEach(result => {
        if (result.confidence > 0.6) { // Only auto-update high confidence detections
          console.log(`Auto-updating ${result.stemId}: ${result.detectedRole} (${(result.confidence * 100).toFixed(1)}%)`);
          onRoleUpdate(result.stemId, result.detectedRole, result.confidence);
        }
      });

      setShowResults(true);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(results);
      }

    } catch (error) {
      console.error('Stem analysis failed:', error);
      alert('Analysis failed. Please check console for details.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualRoleUpdate = (stemId: string, newRole: StemRole) => {
    onRoleUpdate(stemId, newRole, 1.0); // Manual updates have 100% confidence
    
    // Update results to reflect manual change
    setAnalysisResults(prev => prev.map(result => 
      result.stemId === stemId 
        ? { ...result, detectedRole: newRole, confidence: 1.0 }
        : result
    ));
  };

  const handleRevertRoles = () => {
    if (revertData.length === 0) {
      alert('No previous state to revert to');
      return;
    }

    revertData.forEach(({ stemId, originalRole }) => {
      onRoleUpdate(stemId, originalRole, 1.0);
    });

    // Clear results and revert data
    setAnalysisResults([]);
    setShowResults(false);
    setRevertData([]);
    
    console.log('Reverted all role assignments to original state');
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#22c55e'; // Green - High confidence
    if (confidence >= 0.6) return '#f59e0b'; // Orange - Medium confidence
    return '#ef4444'; // Red - Low confidence
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const renderRoleSelector = (stemId: string, currentRole: StemRole) => {
    return (
      <select
        value={currentRole}
        onChange={(e) => handleManualRoleUpdate(stemId, e.target.value as StemRole)}
        className="role-selector"
      >
        {Object.values(StemRole).map(role => (
          <option key={role} value={role}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="analyze-stems-panel">
      <div className="panel-header">
        <h3>Stem Analysis</h3>
        <div className="analysis-controls">
          <button
            className="analyze-button primary"
            onClick={handleAnalyzeStems}
            disabled={isAnalyzing || stems.length === 0}
          >
            {isAnalyzing ? (
              <>
                <span className="spinner">⟳</span>
                Analyzing...
              </>
            ) : (
              '🔍 Analyze Stems'
            )}
          </button>
          
          {revertData.length > 0 && (
            <button
              className="revert-button secondary"
              onClick={handleRevertRoles}
              title="Revert all role assignments to original state"
            >
              ↺ Revert Roles
            </button>
          )}
        </div>
      </div>

      <div className="stems-status">
        <div className="status-info">
          <span className="stems-count">
            {stems.length} stems loaded, {stems.filter(s => s.buffer).length} ready for analysis
          </span>
          {analysisResults.length > 0 && (
            <span className="analysis-summary">
              Last analysis: {analysisResults.length} stems processed
            </span>
          )}
        </div>
      </div>

      {showResults && analysisResults.length > 0 && (
        <div className="analysis-results">
          <div className="results-header">
            <h4>Detection Results</h4>
            <div className="confidence-legend">
              <span className="legend-item">
                <div className="color-dot high"></div>
                High (80%+)
              </span>
              <span className="legend-item">
                <div className="color-dot medium"></div>
                Medium (60-80%)
              </span>
              <span className="legend-item">
                <div className="color-dot low"></div>
                Low (&lt;60%)
              </span>
            </div>
          </div>

          <div className="results-grid">
            {analysisResults.map(result => {
              const stem = stems.find(s => s.id === result.stemId);
              if (!stem) return null;

              return (
                <div key={result.stemId} className="result-item">
                  <div className="stem-info">
                    <div className="stem-name">{stem.name}</div>
                    <div className="detection-details">
                      <span 
                        className="confidence-badge"
                        style={{ backgroundColor: getConfidenceColor(result.confidence) }}
                      >
                        {getConfidenceLabel(result.confidence)} ({(result.confidence * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="role-assignment">
                    <label>Detected Role:</label>
                    {renderRoleSelector(result.stemId, result.detectedRole)}
                  </div>

                  <div className="reasoning">
                    <label>Analysis:</label>
                    <div className="reasoning-text">{result.reasoning}</div>
                  </div>

                  <div className="feature-summary">
                    <div className="feature-item">
                      <span>Centroid:</span>
                      <span>{result.features.spectralCentroid.toFixed(0)}Hz</span>
                    </div>
                    <div className="feature-item">
                      <span>Percussive:</span>
                      <span>{(result.features.percussiveRatio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="feature-item">
                      <span>Dynamic Range:</span>
                      <span>{result.features.dynamicRange.toFixed(1)}dB</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!showResults && stems.length > 0 && (
        <div className="analysis-help">
          <div className="help-content">
            <h4>Automatic Role Detection</h4>
            <p>Click "Analyze Stems" to automatically detect instrument roles based on:</p>
            <ul>
              <li><strong>Frequency content</strong> - Where the energy is concentrated</li>
              <li><strong>Temporal characteristics</strong> - Percussive vs sustained sounds</li>
              <li><strong>Harmonic structure</strong> - Tonal vs noise-like content</li>
              <li><strong>Dynamic behavior</strong> - Attack, sustain, and decay patterns</li>
            </ul>
            <p>High-confidence detections (&gt;60%) will automatically update role dropdowns. You can manually adjust any assignments.</p>
          </div>
        </div>
      )}

      <div className="heuristics-info">
        <details>
          <summary>Detection Heuristics</summary>
          <div className="heuristics-content">
            <div className="heuristic-item">
              <strong>Kick:</strong> Strong sub-bass (20-80Hz), low spectral centroid, high percussive ratio
            </div>
            <div className="heuristic-item">
              <strong>Snare:</strong> Mid-range energy (200-500Hz) + presence (4-6kHz), percussive transients
            </div>
            <div className="heuristic-item">
              <strong>Hi-hat:</strong> High-frequency dominant (&gt;3kHz), very percussive, short duration
            </div>
            <div className="heuristic-item">
              <strong>Bass:</strong> Low-frequency dominant (40-200Hz), sustained character, low spectral centroid
            </div>
            <div className="heuristic-item">
              <strong>Vocal:</strong> Mid-frequency (500-2kHz), formant structure, harmonic content
            </div>
            <div className="heuristic-item">
              <strong>Lead:</strong> Broad frequency range, moderate harmonic content, sustained or melodic
            </div>
            <div className="heuristic-item">
              <strong>Pad:</strong> Full spectrum, low percussive ratio, sustained character, low dynamics
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default AnalyzeStemsPanel;