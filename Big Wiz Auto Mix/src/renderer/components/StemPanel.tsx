import React, { useCallback } from 'react';
import styled from 'styled-components';
import { StemFile, StemRole } from '../../shared/types';
import { AudioManager } from '../../shared/audioManager';

const StemPanelContainer = styled.div`
  width: 320px;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border-right: 1px solid #444;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #444;
  background: rgba(255, 255, 255, 0.02);
`;

const HeaderTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const DropZone = styled.div<{ isDragOver: boolean }>`
  margin: 8px 0;
  padding: 20px;
  border: 2px dashed ${props => props.isDragOver ? '#4a9eff' : '#666'};
  border-radius: 8px;
  text-align: center;
  color: ${props => props.isDragOver ? '#4a9eff' : '#999'};
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #4a9eff;
    color: #4a9eff;
  }
`;

const StemList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const StemItem = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StemName = styled.input`
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  outline: none;
  flex: 1;
  
  &:focus {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 2px 4px;
  }
`;

const DeleteButton = styled.button`
  background: #d13438;
  border: 1px solid #b12b30;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
  
  &:hover {
    background: #c12a2f;
  }
`;

const RoleSelect = styled.select`
  background: #333;
  border: 1px solid #555;
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
`;

const ControlButton = styled.button<{ active?: boolean }>`
  background: ${props => props.active ? '#0078d4' : 'rgba(255, 255, 255, 0.1)'};
  border: 1px solid ${props => props.active ? '#106ebe' : '#555'};
  color: ${props => props.active ? '#ffffff' : '#ccc'};
  padding: 4px 8px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 11px;
  flex: 1;
  font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
  
  &:hover {
    background: ${props => props.active ? '#106ebe' : 'rgba(255, 255, 255, 0.15)'};
  }
`;

const ContextMenu = styled.div<{ x: number; y: number }>`
  position: fixed;
  top: ${props => props.y}px;
  left: ${props => props.x}px;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 4px 0;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  min-width: 160px;
`;

const ContextMenuItem = styled.div<{ disabled?: boolean; destructive?: boolean }>`
  padding: 8px 12px;
  color: ${props => props.disabled ? '#666' : props.destructive ? '#ff6b6b' : '#ffffff'};
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  font-size: 12px;
  border-bottom: ${props => props.destructive ? '1px solid #444' : 'none'};
  margin-bottom: ${props => props.destructive ? '4px' : '0'};
  
  &:hover {
    background: ${props => props.disabled ? 'transparent' : props.destructive ? '#ff4757' : '#4a9eff'};
    color: ${props => props.disabled ? '#666' : '#ffffff'};
  }
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
`;

interface StemPanelProps {
  stems: StemFile[];
  setStems: React.Dispatch<React.SetStateAction<StemFile[]>>;
  audioManager: AudioManager | null;
  onSaveSession: () => void;
  onLoadSession: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const StemPanel: React.FC<StemPanelProps> = ({ stems, setStems, audioManager, onSaveSession, onLoadSession }) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; stemId: string } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const addAudioFiles = useCallback(async (files: File[]) => {
    console.log(`📁 Processing ${files.length} files...`);
    
    const audioFiles = files.filter(file => {
      const isAudio = file.type.startsWith('audio/') || 
                     /\.(wav|mp3|flac|aiff|m4a|ogg|wma)$/i.test(file.name);
      
      if (!isAudio) {
        console.log(`⚠️ Skipping non-audio file: ${file.name} (${file.type})`);
      }
      
      return isAudio;
    });

    console.log(`🎵 Found ${audioFiles.length} audio files to load`);

    if (audioFiles.length === 0) {
      alert('No supported audio files found. Please select WAV, MP3, FLAC, AIFF, or M4A files.');
      return;
    }

    const newStems: StemFile[] = audioFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name.replace(/\.[^/.]+$/, ''),
      path: (file as any).path || file.name,
      role: StemRole.OTHER,
      gain: 0,
      muted: false,
      solo: false,
      pan: 0,
      autoSpread: true
    }));

    // Load audio files into audio manager
    let successfulLoads = 0;
    let failedLoads = 0;
    
    if (audioManager) {
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const stem = newStems[i];
        
        try {
          console.log(`🔄 Loading ${file.name}...`);
          await audioManager.loadAudioFile(stem.id, file);
          successfulLoads++;
          console.log(`✅ Successfully loaded ${file.name}`);
        } catch (error) {
          console.error(`❌ Failed to load audio file ${file.name}:`, error);
          failedLoads++;
          // Remove failed stem from the list
          newStems.splice(i - failedLoads + 1, 1);
        }
      }
      
      console.log(`📊 Load summary: ${successfulLoads} successful, ${failedLoads} failed`);
      
      if (failedLoads > 0) {
        alert(`Warning: ${failedLoads} audio file(s) could not be loaded. Check the console for details. ${successfulLoads} file(s) loaded successfully.`);
      } else if (successfulLoads > 0) {
        console.log(`🎉 All ${successfulLoads} audio files loaded successfully!`);
      }
    } else {
      console.error('❌ AudioManager not available');
      alert('Audio system not initialized. Please refresh the page and try again.');
      return;
    }

    // Only add stems that were successfully loaded
    if (newStems.length > 0) {
      setStems(prev => [...prev, ...newStems]);
    }
  }, [setStems, audioManager]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    addAudioFiles(files);
  }, [addAudioFiles]);

  const handleBrowseClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,.wav,.mp3,.flac,.aiff,.m4a';
    // Enable folder selection
    (input as any).webkitdirectory = true;
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      addAudioFiles(files);
    };
    
    input.click();
  }, [addAudioFiles]);

  const handleBrowseFilesClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,.wav,.mp3,.flac,.aiff,.m4a';
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      addAudioFiles(files);
    };
    
    input.click();
  }, [addAudioFiles]);

  const updateStem = (id: string, updates: Partial<StemFile>) => {
    setStems(prev => prev.map(stem => 
      stem.id === id ? { ...stem, ...updates } : stem
    ));
  };

  const deleteStem = (id: string) => {
    if (audioManager) {
      audioManager.removeStem(id);
    }
    setStems(prev => prev.filter(stem => stem.id !== id));
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, stemId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, stemId });
  };

  const handleContextMenuAction = (action: string, stemId: string) => {
    const stem = stems.find(s => s.id === stemId);
    if (!stem) return;

    switch (action) {
      case 'solo':
        updateStem(stemId, { solo: !stem.solo, muted: false });
        // Clear solo from other stems if enabling
        if (!stem.solo) {
          setStems(prev => prev.map(s => 
            s.id !== stemId ? { ...s, solo: false } : { ...s, solo: true, muted: false }
          ));
        }
        break;
      case 'mute':
        updateStem(stemId, { muted: !stem.muted, solo: false });
        break;
      case 'rename':
        const newName = prompt('Enter new name:', stem.name);
        if (newName && newName.trim()) {
          updateStem(stemId, { name: newName.trim() });
        }
        break;
      case 'reveal':
        console.log('Reveal in file explorer:', stem.path);
        // TODO: Implement reveal in file explorer
        break;
      case 'normalize':
        console.log('Normalize stem:', stem.name);
        // TODO: Implement normalization
        break;
      case 'remove':
        deleteStem(stemId);
        break;
    }
    setContextMenu(null);
  };

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  return (
    <StemPanelContainer>
      <PanelHeader>
        <HeaderTitle>Stems</HeaderTitle>
        <DropZone
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver ? 'Drop audio files or folders here' : 'Drag stems here'}
        </DropZone>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button 
            onClick={handleBrowseClick}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#0078d4',
              border: '1px solid #106ebe',
              borderRadius: '2px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif'
            }}
          >
            Browse Folder
          </button>
          <button 
            onClick={handleBrowseFilesClick}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#5a5a5a',
              border: '1px solid #4a4a4a',
              borderRadius: '2px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif'
            }}
          >
            Browse Files
          </button>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', fontSize: '11px' }}>
          <button 
            onClick={onSaveSession}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: '#2d7d2d',
              border: '1px solid #1d5d1d',
              borderRadius: '2px',
              color: 'white',
              fontSize: '10px',
              cursor: 'pointer',
              fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif'
            }}
          >
            Save .bigwizamix
          </button>
          <label style={{ flex: 1 }}>
            <input 
              type="file"
              accept=".bigwizamix"
              onChange={onLoadSession}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => {
                const input = document.querySelector('input[accept=".bigwizamix"]') as HTMLInputElement;
                input?.click();
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: '#7d5d2d',
                border: '1px solid #5d3d1d',
                borderRadius: '2px',
                color: 'white',
                fontSize: '10px',
                cursor: 'pointer',
                fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif'
              }}
            >
              Load Session
            </button>
          </label>
        </div>
      </PanelHeader>
      
      <StemList>
        {stems.map(stem => (
          <StemItem 
            key={stem.id}
            onContextMenu={(e) => handleContextMenu(e, stem.id)}
          >
            <StemHeader>
              <StemName
                value={stem.name}
                onChange={(e) => updateStem(stem.id, { name: e.target.value })}
              />
              <DeleteButton onClick={() => deleteStem(stem.id)}>×</DeleteButton>
            </StemHeader>
            
            <RoleSelect
              value={stem.role}
              onChange={(e) => updateStem(stem.id, { role: e.target.value as StemRole })}
            >
              {Object.values(StemRole).map(role => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </RoleSelect>
            
            <Controls>
              <ControlButton
                active={stem.muted}
                onClick={() => updateStem(stem.id, { muted: !stem.muted })}
              >
                MUTE
              </ControlButton>
              <ControlButton
                active={stem.solo}
                onClick={() => updateStem(stem.id, { solo: !stem.solo })}
              >
                SOLO
              </ControlButton>
            </Controls>
          </StemItem>
        ))}
      </StemList>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}>
          <ContextMenuItem onClick={() => handleContextMenuAction('solo', contextMenu.stemId)}>
            {stems.find(s => s.id === contextMenu.stemId)?.solo ? 'Unsolo' : 'Solo'}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextMenuAction('mute', contextMenu.stemId)}>
            {stems.find(s => s.id === contextMenu.stemId)?.muted ? 'Unmute' : 'Mute'}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextMenuAction('rename', contextMenu.stemId)}>
            Rename...
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextMenuAction('reveal', contextMenu.stemId)}>
            Reveal in Explorer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextMenuAction('normalize', contextMenu.stemId)}>
            Normalize to 0dB
          </ContextMenuItem>
          <ContextMenuItem 
            destructive 
            onClick={() => handleContextMenuAction('remove', contextMenu.stemId)}
          >
            Remove
          </ContextMenuItem>
        </ContextMenu>
      )}
    </StemPanelContainer>
  );
};

export default StemPanel;