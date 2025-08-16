import React from 'react';
import styled from 'styled-components';

const HelpModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
`;

const HelpContent = styled.div`
  background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid #555;
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
`;

const HelpTitle = styled.h2`
  margin: 0 0 20px 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid #444;
  padding-bottom: 12px;
`;

const ShortcutSection = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  color: #4a9eff;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const ShortcutGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  align-items: center;
`;

const ShortcutKey = styled.div`
  background: #333;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: #ffffff;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
`;

const ShortcutDescription = styled.div`
  color: #ccc;
  font-size: 12px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
`;

const FooterNote = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #444;
  color: #666;
  font-size: 11px;
  text-align: center;
  font-style: italic;
`;

interface KeyboardShortcutsHelpProps {
  isVisible: boolean;
  onClose: () => void;
}

const shortcuts = {
  'Transport Controls': [
    { key: 'Space', description: 'Play/Pause' },
    { key: 'Esc', description: 'Stop' },
    { key: 'S', description: 'Stop (alternative)' },
  ],
  'File Operations': [
    { key: 'Ctrl+S', description: 'Save Session' },
    { key: 'Ctrl+Shift+S', description: 'Save As' },
    { key: 'Ctrl+O', description: 'Load Session' },
  ],
  'Edit Operations': [
    { key: 'Ctrl+Z', description: 'Undo' },
    { key: 'Ctrl+Shift+Z', description: 'Redo' },
    { key: 'Ctrl+A', description: 'Select All Stems' },
  ],
  'Navigation': [
    { key: 'Ctrl+1', description: 'Switch to Mixer Tab' },
    { key: 'Ctrl+2', description: 'Switch to Visual Tab' },
    { key: 'Ctrl+3', description: 'Switch to Spectrum Tab' },
    { key: 'Ctrl+4', description: 'Switch to Vectorscope Tab' },
  ],
  'Quick Presets': [
    { key: '1', description: 'Vocal Up Preset' },
    { key: '2', description: 'Warm & Wide Preset' },
    { key: '3', description: 'Club-Ready Preset' },
    { key: '4', description: 'Vintage Glue Preset' },
    { key: '5', description: 'Podcast Clarity Preset' },
    { key: '6', description: 'Beat Showcase Preset' },
  ],
  'Stem Controls': [
    { key: 'M', description: 'Toggle Mute (Selected Stems)' },
    { key: 'S', description: 'Toggle Solo (Selected Stems)' },
    { key: 'R', description: 'Reset Gain to 0dB' },
    { key: 'G', description: 'Auto-Spread Stems' },
  ],
  'Help': [
    { key: 'F1', description: 'Show/Hide This Help' },
    { key: 'Shift+?', description: 'Show/Hide This Help' },
  ],
};

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <HelpModal onClick={handleBackdropClick}>
      <HelpContent>
        <CloseButton onClick={onClose} title="Close (Esc)">×</CloseButton>
        <HelpTitle>Keyboard Shortcuts</HelpTitle>
        
        {Object.entries(shortcuts).map(([sectionName, sectionShortcuts]) => (
          <ShortcutSection key={sectionName}>
            <SectionTitle>{sectionName}</SectionTitle>
            <ShortcutGrid>
              {sectionShortcuts.map((shortcut, index) => (
                <React.Fragment key={index}>
                  <ShortcutKey>{shortcut.key}</ShortcutKey>
                  <ShortcutDescription>{shortcut.description}</ShortcutDescription>
                </React.Fragment>
              ))}
            </ShortcutGrid>
          </ShortcutSection>
        ))}
        
        <FooterNote>
          💡 Tip: Keyboard shortcuts work when no input field is focused.<br/>
          Press Esc or click outside to close this help.
        </FooterNote>
      </HelpContent>
    </HelpModal>
  );
};

export default KeyboardShortcutsHelp;