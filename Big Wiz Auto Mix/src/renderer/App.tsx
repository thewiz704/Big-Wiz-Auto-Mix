import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { StemFile, MixerSettings, AnalysisData, SessionData, StemRole } from '../shared/types';
import { AudioManager } from '../shared/audioManager';
import StemPanel from './components/StemPanel';
import MixerPanel from './components/MixerPanel';
import ControlPanel from './components/ControlPanel';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  color: #ffffff;
  font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const App: React.FC = () => {
  const [stems, setStems] = useState<StemFile[]>([]);
  const [mixerSettings, setMixerSettings] = useState<MixerSettings>({
    previewLUFS: -18,
    streamLUFS: -14,
    peakCeiling: -1,
    punch: 0,
    warmth: 0,
    clarity: 0,
    air: 0,
    width: 0,
    reverb: 0,
  });
  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    spectrum: new Array(128).fill(0),
    vectorscope: [],
    lufs: stems.length > 0 ? -23 : 0,
    peak: stems.length > 0 ? -6 : 0,
    referenceSpectrum: stems.length > 0 ? new Array(128).fill(0).map(() => Math.random() * 180 + 20) : new Array(128).fill(0),
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const audioManager = useRef<AudioManager | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    audioManager.current = new AudioManager();
    
    // Initialize audio context for analysis
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
    
    return () => {
      if (audioManager.current) {
        audioManager.current.dispose();
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  // Update playback time
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioManager.current && isPlaying) {
        const time = audioManager.current.getCurrentTime();
        const dur = audioManager.current.getDuration();
        setCurrentTime(time);
        setDuration(dur);
        
        if (time >= dur && dur > 0) {
          // Playback finished
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const updateStem = (id: string, updates: Partial<StemFile>) => {
    setStems(prev => prev.map(stem => {
      if (stem.id === id) {
        const updatedStem = { ...stem, ...updates };
        
        // Update audio manager when stem properties change
        if (audioManager.current) {
          if ('gain' in updates) {
            audioManager.current.setStemGain(id, updatedStem.gain);
          }
          if ('muted' in updates) {
            audioManager.current.setStemMute(id, updatedStem.muted);
          }
          if ('solo' in updates) {
            audioManager.current.setStemSolo(id, updatedStem.solo, prev.map(s => s.id));
          }
        }
        
        return updatedStem;
      }
      return stem;
    }));
  };

  const handlePlay = async () => {
    if (audioManager.current && stems.length > 0) {
      await audioManager.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioManager.current) {
      audioManager.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (audioManager.current) {
      audioManager.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleSeek = (time: number) => {
    if (audioManager.current) {
      audioManager.current.seekTo(time);
      setCurrentTime(time);
    }
  };

  const handleStemRoleUpdate = (stemId: string, newRole: StemRole) => {
    updateStem(stemId, { role: newRole });
    console.log(`Stem ${stemId} role updated to ${newRole}`);
  };

  const saveSession = () => {
    const sessionData: SessionData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      stems,
      mixerSettings,
      projectName: 'Untitled Project'
    };

    const dataStr = JSON.stringify(sessionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `session-${new Date().toISOString().slice(0, 10)}.bigwizamix`;
    link.click();
  };

  const loadSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sessionData: SessionData = JSON.parse(e.target?.result as string);
        setStems(sessionData.stems);
        setMixerSettings(sessionData.mixerSettings);
        console.log('Session loaded:', sessionData.projectName);
      } catch (error) {
        console.error('Failed to load session:', error);
      }
    };
    reader.readAsText(file);
  };

  // Auto-save functionality
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (stems.length > 0) {
        const sessionData: SessionData = {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          stems,
          mixerSettings,
          projectName: 'Auto-saved Project'
        };
        localStorage.setItem('bigwizamix-autosave', JSON.stringify(sessionData));
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [stems, mixerSettings]);

  // Load auto-save on startup
  useEffect(() => {
    const autoSave = localStorage.getItem('bigwizamix-autosave');
    if (autoSave) {
      try {
        const sessionData: SessionData = JSON.parse(autoSave);
        if (sessionData.stems.length > 0) {
          setStems(sessionData.stems);
          setMixerSettings(sessionData.mixerSettings);
          console.log('Auto-save restored');
        }
      } catch (error) {
        console.error('Failed to restore auto-save:', error);
      }
    }
  }, []);

  // Reset analysis data when stems change
  useEffect(() => {
    if (stems.length === 0) {
      setAnalysisData({
        spectrum: new Array(128).fill(0),
        vectorscope: [],
        lufs: 0,
        peak: 0,
        referenceSpectrum: new Array(128).fill(0),
      });
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [stems.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Transport controls
      if (key === ' ') {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
      }

      if (key === 'escape' || key === 's') {
        e.preventDefault();
        handleStop();
      }

      // Global controls
      if (isCtrl) {
        switch (key) {
          case 's':
            e.preventDefault();
            if (isShift) {
              // Save As functionality (could open save dialog)
              console.log('Save As triggered');
            } else {
              saveSession();
            }
            break;

          case 'o':
            e.preventDefault();
            // Trigger load session
            const fileInput = document.querySelector('input[accept=".bigwizamix"]') as HTMLInputElement;
            fileInput?.click();
            break;

          case 'z':
            e.preventDefault();
            console.log(isShift ? 'Redo triggered' : 'Undo triggered');
            // TODO: Implement undo/redo functionality
            break;

          case 'a':
            e.preventDefault();
            console.log('Select all stems');
            // TODO: Select all stems in visual mixer
            break;

          case '1':
          case '2':
          case '3':
          case '4':
            e.preventDefault();
            // Switch mixer tabs
            const tabIndex = parseInt(key) - 1;
            const tabs = ['mixer', 'visual', 'spectrum', 'vectorscope'];
            if (tabs[tabIndex]) {
              console.log(`Switch to ${tabs[tabIndex]} tab`);
              // TODO: Implement tab switching via keyboard
            }
            break;
        }
      }

      // Number keys for quick preset selection (without Ctrl)
      if (!isCtrl && /^[1-6]$/.test(key)) {
        e.preventDefault();
        console.log(`Quick preset ${key} selected`);
        // TODO: Trigger preset selection
      }

      // Quick mute/solo for selected stems
      if (key === 'm' && !isCtrl) {
        e.preventDefault();
        console.log('Toggle mute for selected stems');
        // TODO: Mute selected stems
      }

      if (key === 's' && !isCtrl) {
        e.preventDefault();
        console.log('Toggle solo for selected stems');
        // TODO: Solo selected stems
      }

      // Reset gain for selected stems
      if (key === 'r' && !isCtrl) {
        e.preventDefault();
        console.log('Reset gain to 0dB for selected stems');
        // TODO: Reset gain for selected stems
      }

      // Auto-spread command
      if (key === 'g') {
        e.preventDefault();
        console.log('Auto-spread stems triggered');
        // TODO: Trigger auto-spread
      }

      // Help
      if (key === 'f1' || (key === '?' && isShift)) {
        e.preventDefault();
        setShowKeyboardHelp(!showKeyboardHelp);
      }

      // Close help with Escape
      if (key === 'escape' && showKeyboardHelp) {
        e.preventDefault();
        setShowKeyboardHelp(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handlePlay, handlePause, handleStop, saveSession, showKeyboardHelp]);

  return (
    <AppContainer>
      <MainContent>
        <StemPanel 
          stems={stems} 
          setStems={setStems}
          audioManager={audioManager.current}
          onSaveSession={saveSession}
          onLoadSession={loadSession}
        />
        <MixerPanel 
          stems={stems} 
          analysisData={analysisData}
          mixerSettings={mixerSettings}
          updateStem={updateStem}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSeek={handleSeek}
          audioManager={audioManager.current}
        />
        <ControlPanel 
          mixerSettings={mixerSettings}
          setMixerSettings={setMixerSettings}
          stems={stems}
          analysisData={analysisData}
          projectName="Big Wiz Auto Mix Project"
          audioContext={audioContext.current || undefined}
          onStemRoleUpdate={handleStemRoleUpdate}
          updateStem={updateStem}
        />
      </MainContent>
      
      <KeyboardShortcutsHelp 
        isVisible={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </AppContainer>
  );
};

export default App;