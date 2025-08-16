import React, { useRef, useEffect, useState } from 'react';
import { LUFSMetering } from '../../shared/processingChain';
import './EnhancedLUFSMeter.css';

interface EnhancedLUFSMeterProps {
  metering: LUFSMetering;
  width?: number;
  height?: number;
  targetLUFS?: number;
  showRange?: boolean;
  showHistory?: boolean;
}

export const EnhancedLUFSMeter: React.FC<EnhancedLUFSMeterProps> = ({
  metering,
  width = 300,
  height = 200,
  targetLUFS = -14,
  showRange = true,
  showHistory = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<{
    integrated: number[];
    shortTerm: number[];
    momentary: number[];
    timestamps: number[];
  }>({
    integrated: [],
    shortTerm: [],
    momentary: [],
    timestamps: []
  });
  const [viewMode, setViewMode] = useState<'meters' | 'history' | 'detailed'>('meters');
  
  useEffect(() => {
    // Update history
    const now = Date.now();
    setHistory(prev => {
      const maxHistory = 300; // 5 minutes at 60fps
      
      const newHistory = {
        integrated: [...prev.integrated, metering.integrated].slice(-maxHistory),
        shortTerm: [...prev.shortTerm, metering.shortTerm].slice(-maxHistory),
        momentary: [...prev.momentary, metering.momentary].slice(-maxHistory),
        timestamps: [...prev.timestamps, now].slice(-maxHistory)
      };
      
      return newHistory;
    });
  }, [metering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    if (viewMode === 'meters') {
      drawMeters(ctx, width, height);
    } else if (viewMode === 'history') {
      drawHistory(ctx, width, height);
    } else if (viewMode === 'detailed') {
      drawDetailed(ctx, width, height);
    }
  }, [metering, history, viewMode, width, height, targetLUFS, showRange]);

  const drawMeters = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padding = 20;
    const meterWidth = 40;
    const meterHeight = h - 80;
    const spacing = 15;
    
    // Background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(padding, padding, w - padding * 2, h - padding * 2);
    
    // LUFS scale (-60 to 0)
    const minLUFS = -60;
    const maxLUFS = 0;
    const lufsToY = (lufs: number) => {
      const normalized = (lufs - minLUFS) / (maxLUFS - minLUFS);
      return h - 60 - (normalized * meterHeight);
    };
    
    // Draw scale
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    for (let lufs = minLUFS; lufs <= maxLUFS; lufs += 6) {
      const y = lufsToY(lufs);
      ctx.fillText(`${lufs}`, 5, y + 3);
      
      // Draw grid line
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }
    
    // Target line
    if (targetLUFS >= minLUFS && targetLUFS <= maxLUFS) {
      const targetY = lufsToY(targetLUFS);
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, targetY);
      ctx.lineTo(w - padding, targetY);
      ctx.stroke();
      
      ctx.fillStyle = '#ff6b35';
      ctx.fillText(`Target: ${targetLUFS}`, w - 80, targetY - 5);
    }
    
    // Draw meters
    const meters = [
      { label: 'I', value: metering.integrated, color: '#4ade80', x: padding + 20 },
      { label: 'S', value: metering.shortTerm, color: '#60a5fa', x: padding + 20 + meterWidth + spacing },
      { label: 'M', value: metering.momentary, color: '#f472b6', x: padding + 20 + (meterWidth + spacing) * 2 }
    ];
    
    meters.forEach(meter => {
      // Meter background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(meter.x, 40, meterWidth, meterHeight);
      
      // Meter border
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(meter.x, 40, meterWidth, meterHeight);
      
      // Meter value
      if (meter.value > minLUFS) {
        const valueHeight = Math.min(meterHeight, ((meter.value - minLUFS) / (maxLUFS - minLUFS)) * meterHeight);
        const gradient = ctx.createLinearGradient(0, 40 + meterHeight, 0, 40);
        gradient.addColorStop(0, meter.color + '80');
        gradient.addColorStop(1, meter.color);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(meter.x + 2, 40 + meterHeight - valueHeight, meterWidth - 4, valueHeight);
      }
      
      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(meter.label, meter.x + meterWidth / 2, h - 45);
      
      // Value
      ctx.font = '11px monospace';
      ctx.fillText(`${meter.value.toFixed(1)}`, meter.x + meterWidth / 2, h - 25);
    });
    
    // Peak and Range
    const infoX = padding + 20 + (meterWidth + spacing) * 3 + 20;
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Peak: ${metering.peak.toFixed(1)} dBFS`, infoX, 60);
    
    if (showRange) {
      ctx.fillText(`Range: ${metering.range.toFixed(1)} LU`, infoX, 80);
    }
    
    ctx.fillText(`Gating: ${metering.gatingEnabled ? 'ON' : 'OFF'}`, infoX, 100);
  };

  const drawHistory = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padding = 40;
    const plotWidth = w - padding * 2;
    const plotHeight = h - padding * 2;
    
    if (history.integrated.length < 2) return;
    
    // Background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(padding, padding, plotWidth, plotHeight);
    
    // Draw grid
    const minLUFS = Math.min(-60, Math.min(...history.integrated, ...history.shortTerm, ...history.momentary) - 5);
    const maxLUFS = Math.max(0, Math.max(...history.integrated, ...history.shortTerm, ...history.momentary) + 5);
    
    // Y-axis grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let lufs = Math.ceil(minLUFS / 6) * 6; lufs <= maxLUFS; lufs += 6) {
      const y = padding + plotHeight - ((lufs - minLUFS) / (maxLUFS - minLUFS)) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotWidth, y);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lufs}`, padding - 5, y + 3);
    }
    
    // X-axis (time)
    const timeSpan = 300000; // 5 minutes in ms
    const now = Date.now();
    for (let i = 0; i <= 5; i++) {
      const x = padding + (i / 5) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + plotHeight);
      ctx.stroke();
      
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText(`${5 - i}m`, x, h - 10);
    }
    
    // Draw lines
    const drawLine = (data: number[], color: string, lineWidth: number = 2) => {
      if (data.length < 2) return;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      
      data.forEach((value, index) => {
        const x = padding + (index / (data.length - 1)) * plotWidth;
        const y = padding + plotHeight - ((value - minLUFS) / (maxLUFS - minLUFS)) * plotHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    };
    
    drawLine(history.momentary, '#f472b6', 1);
    drawLine(history.shortTerm, '#60a5fa', 2);
    drawLine(history.integrated, '#4ade80', 3);
    
    // Target line
    if (targetLUFS >= minLUFS && targetLUFS <= maxLUFS) {
      const targetY = padding + plotHeight - ((targetLUFS - minLUFS) / (maxLUFS - minLUFS)) * plotHeight;
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, targetY);
      ctx.lineTo(padding + plotWidth, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Legend
    const legend = [
      { label: 'Integrated', color: '#4ade80' },
      { label: 'Short-term', color: '#60a5fa' },
      { label: 'Momentary', color: '#f472b6' }
    ];
    
    legend.forEach((item, index) => {
      const y = 25 + index * 15;
      ctx.fillStyle = item.color;
      ctx.fillRect(w - 120, y, 15, 2);
      ctx.fillStyle = '#ccc';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, w - 100, y + 5);
    });
  };

  const drawDetailed = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Detailed view with numerical displays and compliance indicators
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, h);
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LUFS Detailed Analysis', w / 2, 25);
    
    // Main measurements
    const measurements = [
      { label: 'Integrated LUFS', value: metering.integrated, unit: 'LUFS', color: '#4ade80' },
      { label: 'Short-term LUFS', value: metering.shortTerm, unit: 'LUFS', color: '#60a5fa' },
      { label: 'Momentary LUFS', value: metering.momentary, unit: 'LUFS', color: '#f472b6' },
      { label: 'True Peak', value: metering.peak, unit: 'dBFS', color: '#fbbf24' },
      { label: 'Loudness Range', value: metering.range, unit: 'LU', color: '#a78bfa' }
    ];
    
    const startY = 50;
    const rowHeight = 25;
    
    measurements.forEach((measurement, index) => {
      const y = startY + index * rowHeight;
      
      // Label
      ctx.fillStyle = '#ccc';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(measurement.label, 20, y);
      
      // Value
      ctx.fillStyle = measurement.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${measurement.value.toFixed(1)} ${measurement.unit}`, w - 20, y);
    });
    
    // Compliance indicators
    const complianceY = startY + measurements.length * rowHeight + 20;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Broadcast Standards:', 20, complianceY);
    
    const standards = [
      { name: 'EBU R128', target: -23, tolerance: 1 },
      { name: 'ATSC A/85', target: -24, tolerance: 2 },
      { name: 'Streaming', target: targetLUFS, tolerance: 1 }
    ];
    
    standards.forEach((standard, index) => {
      const y = complianceY + 20 + index * 20;
      const diff = Math.abs(metering.integrated - standard.target);
      const compliant = diff <= standard.tolerance;
      
      ctx.fillStyle = compliant ? '#4ade80' : '#ef4444';
      ctx.fillText(`● ${standard.name}`, 30, y);
      
      ctx.fillStyle = '#ccc';
      ctx.font = '11px monospace';
      const status = compliant ? 'PASS' : `${diff.toFixed(1)}LU over`;
      ctx.fillText(status, 150, y);
    });
  };

  return (
    <div className="enhanced-lufs-meter">
      <div className="meter-controls">
        <button 
          className={viewMode === 'meters' ? 'active' : ''}
          onClick={() => setViewMode('meters')}
        >
          Meters
        </button>
        <button 
          className={viewMode === 'history' ? 'active' : ''}
          onClick={() => setViewMode('history')}
        >
          History
        </button>
        <button 
          className={viewMode === 'detailed' ? 'active' : ''}
          onClick={() => setViewMode('detailed')}
        >
          Analysis
        </button>
      </div>
      
      <canvas 
        ref={canvasRef}
        className="lufs-canvas"
      />
      
      <div className="meter-footer">
        <div className="quick-stats">
          <span className="stat">
            <label>I:</label>
            <span style={{color: '#4ade80'}}>{metering.integrated.toFixed(1)}</span>
          </span>
          <span className="stat">
            <label>S:</label>
            <span style={{color: '#60a5fa'}}>{metering.shortTerm.toFixed(1)}</span>
          </span>
          <span className="stat">
            <label>M:</label>
            <span style={{color: '#f472b6'}}>{metering.momentary.toFixed(1)}</span>
          </span>
          <span className="stat">
            <label>Peak:</label>
            <span style={{color: '#fbbf24'}}>{metering.peak.toFixed(1)}</span>
          </span>
        </div>
      </div>
    </div>
  );
};