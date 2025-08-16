import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

const AnalyzerContainer = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const AnalyzerTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
`;

const CanvasContainer = styled.div`
  flex: 1;
  width: 100%;
  max-width: 800px;
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

const FrequencyLabels = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 11px;
  color: #666;
`;

interface SpectrumAnalyzerProps {
  data: number[];
  referenceData?: number[];
}

const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ data, referenceData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / data.length;

    // Draw reference spectrum first (if available)
    if (referenceData && referenceData.length > 0) {
      const refGradient = ctx.createLinearGradient(0, height, 0, 0);
      refGradient.addColorStop(0, '#ff6b35');
      refGradient.addColorStop(0.5, '#ff8c55');
      refGradient.addColorStop(1, '#ffad75');
      
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = refGradient;
      
      for (let i = 0; i < Math.min(data.length, referenceData.length); i++) {
        const barHeight = (referenceData[i] / 255) * height * 0.8;
        const x = i * barWidth;
        const y = height - barHeight;
        
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      }
      
      ctx.globalAlpha = 1.0;
    }

    // Draw current mix spectrum
    const mixGradient = ctx.createLinearGradient(0, height, 0, 0);
    mixGradient.addColorStop(0, '#4a9eff');
    mixGradient.addColorStop(0.5, '#5aafff');
    mixGradient.addColorStop(1, '#7ac5ff');

    ctx.fillStyle = mixGradient;
    ctx.globalAlpha = referenceData ? 0.8 : 1.0;

    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height * 0.8;
      const x = i * barWidth;
      const y = height - barHeight;
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }

    ctx.globalAlpha = 1.0;

    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Add legend if reference is shown
    if (referenceData) {
      ctx.font = '11px Segoe UI';
      ctx.fillStyle = '#4a9eff';
      ctx.fillText('● Mix', width - 80, 20);
      ctx.fillStyle = '#ff6b35';
      ctx.fillText('● Reference', width - 80, 35);
    }
  }, [data, referenceData]);

  return (
    <AnalyzerContainer>
      <AnalyzerTitle>Spectrum Analyzer</AnalyzerTitle>
      <CanvasContainer>
        <Canvas ref={canvasRef} />
      </CanvasContainer>
      <FrequencyLabels>
        <span>20 Hz</span>
        <span>100 Hz</span>
        <span>1 kHz</span>
        <span>10 kHz</span>
        <span>20 kHz</span>
      </FrequencyLabels>
    </AnalyzerContainer>
  );
};

export default SpectrumAnalyzer;