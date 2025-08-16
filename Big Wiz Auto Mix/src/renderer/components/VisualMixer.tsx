import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { StemFile, StemRole } from '../../shared/types';

const VisualMixerContainer = styled.div`
  flex: 1;
  background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
  border: 1px solid #333;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  cursor: crosshair;
  min-height: 400px;
`;

const MixerCanvas = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

const StemNode = styled.div<{ 
  x: number; 
  y: number; 
  size: number; 
  color: string; 
  selected: boolean;
  muted: boolean;
  solo: boolean;
}>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  background: ${props => props.color};
  border: 2px solid ${props => 
    props.solo ? '#ffa502' : 
    props.selected ? '#ffffff' : 
    props.color};
  border-radius: 50%;
  cursor: pointer;
  transform: translate(-50%, -50%);
  opacity: ${props => props.muted ? 0.3 : 1};
  box-shadow: 
    0 0 ${props => props.size / 4}px ${props => props.color}40,
    ${props => props.selected ? `0 0 ${props.size}px ${props.color}80` : 'none'};
  transition: all 0.2s ease;
  z-index: ${props => props.selected ? 1000 : props.solo ? 900 : 100};
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 
      0 0 ${props => props.size / 2}px ${props => props.color}60,
      0 0 ${props => props.size}px ${props => props.color}40;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${props => props.size * 0.6}px;
    height: ${props => props.size * 0.6}px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    opacity: ${props => props.muted ? 0.3 : props.solo ? 1 : 0.8};
  }
`;

const StemLabel = styled.div<{ x: number; y: number; size: number }>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y + props.size / 2 + 8}px;
  transform: translateX(-50%);
  font-size: 10px;
  color: #ccc;
  background: rgba(0, 0, 0, 0.7);
  padding: 2px 6px;
  border-radius: 10px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1001;
`;

const GridOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.1;
  background-image: 
    linear-gradient(90deg, #333 1px, transparent 1px),
    linear-gradient(180deg, #333 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
`;

const SelectionBox = styled.div<{ x: number; y: number; width: number; height: number }>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  border: 1px dashed #4a9eff;
  background: rgba(74, 158, 255, 0.1);
  pointer-events: none;
  z-index: 999;
`;

const ToolPanel = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  z-index: 1002;
`;

const ToolButton = styled.button<{ active?: boolean }>`
  padding: 8px 12px;
  background: ${props => props.active ? '#4a9eff' : 'rgba(0, 0, 0, 0.7)'};
  border: 1px solid ${props => props.active ? '#4a9eff' : '#555'};
  border-radius: 4px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: ${props => props.active ? '#5aafff' : 'rgba(255, 255, 255, 0.1)'};
  }
`;

const StatusPanel = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 10px;
  color: #ccc;
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

interface VisualMixerProps {
  stems: StemFile[];
  updateStem: (id: string, updates: Partial<StemFile>) => void;
  onAutoSpread?: () => void;
}

const ROLE_COLORS = {
  [StemRole.KICK]: '#ff4757',
  [StemRole.SNARE]: '#ff6b7a',
  [StemRole.HIHAT]: '#ffa502',
  [StemRole.DRUMS]: '#ffb347',
  [StemRole.PERCUSSION]: '#ff7675',
  [StemRole.BASS]: '#2ed573',
  [StemRole.LEAD]: '#4a9eff',
  [StemRole.PAD]: '#5f69ff',
  [StemRole.ARPEGGIO]: '#9c88ff',
  [StemRole.VOCAL]: '#ff9ff3',
  [StemRole.HARMONY]: '#ffc8dd',
  [StemRole.FX]: '#54a0ff',
  [StemRole.OTHER]: '#57606f'
};

const VisualMixer: React.FC<VisualMixerProps> = ({ stems, updateStem, onAutoSpread }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedStems, setSelectedStems] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'move'>('select');
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Initialize stem positions if not set
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      stems.forEach((stem, index) => {
        if (!stem.x || !stem.y) {
          // Spiral placement algorithm
          const angle = index * 0.8;
          const radius = 50 + (index * 15);
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          updateStem(stem.id, { 
            x: Math.max(40, Math.min(rect.width - 40, x)), 
            y: Math.max(40, Math.min(rect.height - 40, y))
          });
        }
      });
    }
  }, [stems.length]);

  const getStemSize = useCallback((stem: StemFile): number => {
    // Size based on LUFS (loudness)
    const baseLUFS = -20 + (stem.gain * 0.8);
    const stemLUFS = Math.max(-40, Math.min(-6, baseLUFS));
    return Math.max(12, Math.min(40, Math.abs(stemLUFS + 30) * 1.2));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragStart({ x, y });
    setIsDragging(true);
    
    if (dragMode === 'select') {
      // Clear selection unless Ctrl is held
      if (!e.ctrlKey) {
        setSelectedStems(new Set());
      }
      setSelectionBox({ x, y, width: 0, height: 0 });
    }
  }, [dragMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (dragMode === 'select' && selectionBox) {
      const width = x - dragStart.x;
      const height = y - dragStart.y;
      setSelectionBox({
        x: width < 0 ? x : dragStart.x,
        y: height < 0 ? y : dragStart.y,
        width: Math.abs(width),
        height: Math.abs(height)
      });
    } else if (dragMode === 'move' && selectedStems.size > 0) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      
      selectedStems.forEach(stemId => {
        const stem = stems.find(s => s.id === stemId);
        if (stem) {
          const newX = Math.max(20, Math.min(rect.width - 20, (stem.x || 0) + deltaX));
          const newY = Math.max(20, Math.min(rect.height - 20, (stem.y || 0) + deltaY));
          updateStem(stemId, { x: newX, y: newY });
        }
      });
      
      setDragStart({ x, y });
    }
  }, [isDragging, dragStart, dragMode, selectionBox, selectedStems, stems, updateStem]);

  const handleMouseUp = useCallback(() => {
    if (selectionBox && dragMode === 'select') {
      // Find stems within selection box
      const selected = new Set(selectedStems);
      stems.forEach(stem => {
        if (stem.x && stem.y) {
          const stemInBox = 
            stem.x >= selectionBox.x && 
            stem.x <= selectionBox.x + selectionBox.width &&
            stem.y >= selectionBox.y && 
            stem.y <= selectionBox.y + selectionBox.height;
          
          if (stemInBox) {
            selected.add(stem.id);
          }
        }
      });
      setSelectedStems(selected);
    }
    
    setIsDragging(false);
    setDragStart(null);
    setSelectionBox(null);
  }, [selectionBox, dragMode, selectedStems, stems]);

  const handleStemClick = useCallback((e: React.MouseEvent, stemId: string) => {
    e.stopPropagation();
    
    if (e.ctrlKey) {
      const newSelected = new Set(selectedStems);
      if (newSelected.has(stemId)) {
        newSelected.delete(stemId);
      } else {
        newSelected.add(stemId);
      }
      setSelectedStems(newSelected);
    } else {
      setSelectedStems(new Set([stemId]));
    }
  }, [selectedStems]);

  const handleStemDoubleClick = useCallback((stemId: string) => {
    const stem = stems.find(s => s.id === stemId);
    if (stem) {
      updateStem(stemId, { solo: !stem.solo });
    }
  }, [stems, updateStem]);

  const handleAutoSpread = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Group stems by role for intelligent positioning
    const roleGroups: { [key: string]: StemFile[] } = {};
    stems.forEach(stem => {
      if (!roleGroups[stem.role]) {
        roleGroups[stem.role] = [];
      }
      roleGroups[stem.role].push(stem);
    });
    
    // Position each role group in a circular pattern
    const roles = Object.keys(roleGroups);
    roles.forEach((role, roleIndex) => {
      const roleAngle = (roleIndex / roles.length) * 2 * Math.PI;
      const roleRadius = Math.min(rect.width, rect.height) * 0.3;
      const roleCenterX = centerX + Math.cos(roleAngle) * roleRadius;
      const roleCenterY = centerY + Math.sin(roleAngle) * roleRadius;
      
      // Position stems within each role group
      const stemsInRole = roleGroups[role];
      stemsInRole.forEach((stem, stemIndex) => {
        if (stemsInRole.length === 1) {
          updateStem(stem.id, { x: roleCenterX, y: roleCenterY });
        } else {
          const stemAngle = (stemIndex / stemsInRole.length) * 2 * Math.PI;
          const stemRadius = 40;
          const stemX = roleCenterX + Math.cos(stemAngle) * stemRadius;
          const stemY = roleCenterY + Math.sin(stemAngle) * stemRadius;
          
          updateStem(stem.id, { 
            x: Math.max(20, Math.min(rect.width - 20, stemX)), 
            y: Math.max(20, Math.min(rect.height - 20, stemY))
          });
        }
      });
    });
    
    onAutoSpread?.();
  }, [stems, updateStem, onAutoSpread]);

  return (
    <VisualMixerContainer
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <GridOverlay />
      
      <ToolPanel>
        <ToolButton 
          active={dragMode === 'select'} 
          onClick={() => setDragMode('select')}
          title="Selection mode (drag to select multiple stems)"
        >
          Select
        </ToolButton>
        <ToolButton 
          active={dragMode === 'move'} 
          onClick={() => setDragMode('move')}
          title="Move mode (drag selected stems)"
        >
          Move
        </ToolButton>
        <ToolButton onClick={handleAutoSpread} title="Auto-spread stems by role">
          Auto-Spread
        </ToolButton>
        <ToolButton 
          onClick={() => setSelectedStems(new Set(stems.map(s => s.id)))}
          title="Select all stems"
        >
          Select All
        </ToolButton>
      </ToolPanel>
      
      <MixerCanvas>
        {stems.map(stem => {
          if (!stem.x || !stem.y) return null;
          
          const size = getStemSize(stem);
          const color = ROLE_COLORS[stem.role] || ROLE_COLORS[StemRole.OTHER];
          const selected = selectedStems.has(stem.id);
          
          return (
            <React.Fragment key={stem.id}>
              <StemNode
                x={stem.x}
                y={stem.y}
                size={size}
                color={color}
                selected={selected}
                muted={stem.muted}
                solo={stem.solo}
                onClick={(e) => handleStemClick(e, stem.id)}
                onDoubleClick={() => handleStemDoubleClick(stem.id)}
                title={`${stem.name} (${stem.role}) - ${stem.gain.toFixed(1)}dB`}
              />
              <StemLabel x={stem.x} y={stem.y} size={size}>
                {stem.name}
              </StemLabel>
            </React.Fragment>
          );
        })}
        
        {selectionBox && (
          <SelectionBox
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.width}
            height={selectionBox.height}
          />
        )}
      </MixerCanvas>
      
      <StatusPanel>
        <div>
          {selectedStems.size > 0 ? `${selectedStems.size} stem(s) selected` : 'No selection'}
        </div>
        <div>
          {dragMode === 'select' ? 'Selection Mode' : 'Move Mode'} | 
          Double-click: Solo | Ctrl+Click: Multi-select
        </div>
      </StatusPanel>
    </VisualMixerContainer>
  );
};

export default VisualMixer;