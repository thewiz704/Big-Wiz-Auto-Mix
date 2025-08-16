import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SpectrumAnalysis, MaskingHeatmap } from '../../shared/processingChain';
import './DualSpectrumAnalyzer.css';

interface DualSpectrumAnalyzerProps {
  mixSpectrum: SpectrumAnalysis;
  referenceSpectrum?: SpectrumAnalysis;
  maskingData?: MaskingHeatmap;
  width?: number;
  height?: number;
  showReference?: boolean;
  showMasking?: boolean;
}

export const DualSpectrumAnalyzer: React.FC<DualSpectrumAnalyzerProps> = ({
  mixSpectrum,
  referenceSpectrum,
  maskingData,
  width = 600,
  height = 300,
  showReference = true,
  showMasking = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [smoothing, setSmoothing] = useState(0.8);
  const [viewMode, setViewMode] = useState<'spectrum' | 'masking' | 'comparison'>('spectrum');
  const [freezeReference, setFreezeReference] = useState(false);
  const [frozenReference, setFrozenReference] = useState<SpectrumAnalysis | null>(null);
  const [selectedStem, setSelectedStem] = useState<string>('');

  // Frequency mapping
  const frequencyToX = useCallback((freq: number, canvasWidth: number) => {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(Math.max(freq, minFreq));
    return ((logFreq - logMin) / (logMax - logMin)) * canvasWidth;
  }, []);

  const xToFrequency = useCallback((x: number, canvasWidth: number) => {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = logMin + (x / canvasWidth) * (logMax - logMin);
    return Math.pow(10, logFreq);
  }, []);

  const magnitudeToY = useCallback((magnitude: number, canvasHeight: number) => {
    const minDb = -80;
    const maxDb = 20;
    const db = 20 * Math.log10(Math.max(magnitude, 0.00001));
    const normalizedDb = (db - minDb) / (maxDb - minDb);
    return canvasHeight - (normalizedDb * canvasHeight);
  }, []);

  useEffect(() => {
    if (freezeReference && referenceSpectrum && !frozenReference) {
      setFrozenReference(JSON.parse(JSON.stringify(referenceSpectrum)));
    }
  }, [freezeReference, referenceSpectrum, frozenReference]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    if (viewMode === 'spectrum') {
      drawSpectrum(ctx);
    } else if (viewMode === 'masking' && maskingData) {
      drawMaskingHeatmap(ctx);
    } else if (viewMode === 'comparison') {
      drawComparison(ctx);
    }
    
    drawGrid(ctx);
    drawLabels(ctx);
  }, [mixSpectrum, referenceSpectrum, frozenReference, maskingData, viewMode, smoothing, width, height, selectedStem]);

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const padding = 40;
    
    // Frequency grid lines
    const frequencies = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    frequencies.forEach(freq => {
      const x = padding + frequencyToX(freq, width - padding * 2);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    });
    
    // Magnitude grid lines
    for (let db = -60; db <= 0; db += 12) {
      const magnitude = Math.pow(10, db / 20);
      const y = magnitudeToY(magnitude, height - padding * 2) + padding;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
  };

  const drawLabels = (ctx: CanvasRenderingContext2D) => {
    const padding = 40;
    
    // Frequency labels
    const frequencies = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    frequencies.forEach(freq => {
      const x = padding + frequencyToX(freq, width - padding * 2);
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, height - 10);
    });
    
    // Magnitude labels
    ctx.textAlign = 'right';
    for (let db = -60; db <= 0; db += 12) {
      const magnitude = Math.pow(10, db / 20);
      const y = magnitudeToY(magnitude, height - padding * 2) + padding + 3;
      ctx.fillText(`${db}dB`, padding - 5, y);
    }
    
    // Axis labels
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (Hz)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Magnitude (dB)', 0, 0);
    ctx.restore();
  };

  const drawSpectrum = (ctx: CanvasRenderingContext2D) => {
    const padding = 40;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    
    // Draw mix spectrum
    if (mixSpectrum.magnitudes.length > 0) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      mixSpectrum.frequencies.forEach((freq, index) => {
        if (index < mixSpectrum.magnitudes.length) {
          const x = padding + frequencyToX(freq, plotWidth);
          const y = padding + magnitudeToY(mixSpectrum.magnitudes[index], plotHeight);
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      
      ctx.stroke();
    }
    
    // Draw reference spectrum
    const refToUse = frozenReference || referenceSpectrum;
    if (showReference && refToUse && refToUse.magnitudes.length > 0) {
      ctx.strokeStyle = freezeReference ? '#ff6b35' : '#60a5fa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      
      refToUse.frequencies.forEach((freq, index) => {
        if (index < refToUse.magnitudes.length) {
          const x = padding + frequencyToX(freq, plotWidth);
          const y = padding + magnitudeToY(refToUse.magnitudes[index], plotHeight);
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawMaskingHeatmap = (ctx: CanvasRenderingContext2D) => {
    if (!maskingData) return;
    
    const padding = 40;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    
    // Draw heatmap
    const cellWidth = plotWidth / maskingData.frequencies.length;
    const cellHeight = plotHeight / maskingData.stems.length;
    
    maskingData.stems.forEach((stem, stemIndex) => {
      maskingData.frequencies.forEach((freq, freqIndex) => {
        const conflict = maskingData.maskingMatrix[stemIndex]?.[freqIndex] || 0;
        
        // Color based on conflict level
        const intensity = Math.min(conflict * 255, 255);
        const alpha = conflict;
        ctx.fillStyle = `rgba(255, ${255 - intensity}, ${255 - intensity}, ${alpha})`;
        
        const x = padding + frequencyToX(freq, plotWidth);
        const y = padding + stemIndex * cellHeight;
        
        ctx.fillRect(x - cellWidth / 2, y, cellWidth, cellHeight);
      });
      
      // Stem labels
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stem, padding + 5, padding + stemIndex * cellHeight + cellHeight / 2 + 4);
    });
    
    // Highlight selected stem
    if (selectedStem) {
      const stemIndex = maskingData.stems.indexOf(selectedStem);
      if (stemIndex >= 0) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(padding, padding + stemIndex * cellHeight, plotWidth, cellHeight);
      }
    }
  };

  const drawComparison = (ctx: CanvasRenderingContext2D) => {
    const padding = 40;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    
    const refToUse = frozenReference || referenceSpectrum;
    if (!refToUse || mixSpectrum.magnitudes.length === 0) {
      drawSpectrum(ctx);
      return;
    }
    
    // Calculate difference spectrum
    const differences: number[] = [];
    const maxLength = Math.min(mixSpectrum.magnitudes.length, refToUse.magnitudes.length);
    
    for (let i = 0; i < maxLength; i++) {
      const mixDb = 20 * Math.log10(Math.max(mixSpectrum.magnitudes[i], 0.00001));
      const refDb = 20 * Math.log10(Math.max(refToUse.magnitudes[i], 0.00001));
      differences.push(mixDb - refDb);
    }
    
    // Draw difference as filled area
    ctx.fillStyle = 'rgba(255, 107, 53, 0.3)';
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Start at zero line
    const zeroY = padding + magnitudeToY(1, plotHeight); // 0 dB line
    
    mixSpectrum.frequencies.slice(0, maxLength).forEach((freq, index) => {
      const x = padding + frequencyToX(freq, plotWidth);
      const diffMagnitude = Math.pow(10, differences[index] / 20);
      const y = padding + magnitudeToY(diffMagnitude, plotHeight);
      
      if (index === 0) {
        ctx.moveTo(x, zeroY);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    // Close the path to zero line
    const lastFreq = mixSpectrum.frequencies[maxLength - 1];
    const lastX = padding + frequencyToX(lastFreq, plotWidth);
    ctx.lineTo(lastX, zeroY);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    // Draw zero line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding, zeroY);
    ctx.lineTo(width - padding, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (viewMode !== 'masking' || !maskingData) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const padding = 40;
    const plotHeight = height - padding * 2;
    const cellHeight = plotHeight / maskingData.stems.length;
    
    if (x >= padding && y >= padding && y <= height - padding) {
      const stemIndex = Math.floor((y - padding) / cellHeight);
      if (stemIndex >= 0 && stemIndex < maskingData.stems.length) {
        setSelectedStem(maskingData.stems[stemIndex]);
      }
    }
  };

  return (
    <div className="dual-spectrum-analyzer">
      <div className="analyzer-controls">
        <div className="view-controls">
          <button 
            className={viewMode === 'spectrum' ? 'active' : ''}
            onClick={() => setViewMode('spectrum')}
          >
            Spectrum
          </button>
          <button 
            className={viewMode === 'comparison' ? 'active' : ''}
            onClick={() => setViewMode('comparison')}
            disabled={!referenceSpectrum}
          >
            Compare
          </button>
          <button 
            className={viewMode === 'masking' ? 'active' : ''}
            onClick={() => setViewMode('masking')}
            disabled={!maskingData}
          >
            Masking
          </button>
        </div>
        
        <div className="analysis-controls">
          <label className="smoothing-control">
            Smoothing:
            <input
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              value={smoothing}
              onChange={(e) => setSmoothing(parseFloat(e.target.value))}
            />
            <span>{Math.round(smoothing * 100)}%</span>
          </label>
          
          {referenceSpectrum && (
            <label className="freeze-control">
              <input
                type="checkbox"
                checked={freezeReference}
                onChange={(e) => {
                  setFreezeReference(e.target.checked);
                  if (!e.target.checked) {
                    setFrozenReference(null);
                  }
                }}
              />
              Freeze Ref
            </label>
          )}
        </div>
      </div>
      
      <canvas 
        ref={canvasRef}
        className="spectrum-canvas"
        onClick={handleCanvasClick}
      />
      
      <div className="analyzer-footer">
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color mix"></div>
            <span>Mix</span>
          </div>
          {showReference && (referenceSpectrum || frozenReference) && (
            <div className="legend-item">
              <div className={`legend-color ${freezeReference ? 'frozen' : 'reference'}`}></div>
              <span>{freezeReference ? 'Frozen Ref' : 'Reference'}</span>
            </div>
          )}
        </div>
        
        {viewMode === 'masking' && selectedStem && (
          <div className="masking-info">
            <span>Selected: <strong>{selectedStem}</strong></span>
            <span className="conflict-level">
              Conflict Level: <strong>{maskingData?.conflictLevel || 'Unknown'}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};