import React from 'react';
import { Activity, ShieldCheck, Volume2, VolumeX, Maximize2, Minimize2, FileText, RefreshCw, HelpCircle, Target } from 'lucide-react';

interface HeaderNavProps {
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResetSession: () => void;
  onOpenReport: () => void;
  onOpenDefenseGuide: () => void;
  isCameraActive: boolean;
  engineType: string;
  activeProtocol: 'task-3-4' | 'task-3-12' | 'task-3-15';
  onSelectProtocol: (protocol: 'task-3-4' | 'task-3-12' | 'task-3-15') => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  isAudioMuted,
  onToggleAudio,
  isFullscreen,
  onToggleFullscreen,
  onResetSession,
  onOpenReport,
  onOpenDefenseGuide,
  isCameraActive,
  engineType,
  activeProtocol,
  onSelectProtocol
}) => {
  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0.65rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        
        {/* Brand & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 3px 10px rgba(2, 132, 199, 0.25)' }}>
            <Activity size={20} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                NeuroKinematics <span style={{ color: '#0284c7' }}>AI™</span>
              </span>
              <span style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, border: '1px solid #bae6fd', letterSpacing: '0.04em' }}>
                MDS-UPDRS CLINICAL
              </span>
              <span style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem', borderRadius: '4px', background: isCameraActive ? '#f0fdf4' : '#f8fafc', color: isCameraActive ? '#15803d' : '#64748b', fontWeight: 700, border: `1px solid ${isCameraActive ? '#bbf7d0' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck size={11} /> {isCameraActive ? 'LIVE 60 FPS • GPU' : 'SENSOR STANDBY'}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
              Sub-Millimeter 3D Movement Disorder & 4-Condition Differential Classifier
            </p>
          </div>
        </div>

        {/* Active Examination Protocol Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '0.25rem 0.4rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => onSelectProtocol('task-3-4')}
            style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: activeProtocol === 'task-3-4' ? '#0284c7' : 'transparent', color: activeProtocol === 'task-3-4' ? '#ffffff' : '#475569', transition: 'all 0.15s ease' }}
          >
            Task 3.4: Finger Tapping
          </button>
          <button
            onClick={() => onSelectProtocol('task-3-12')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: activeProtocol === 'task-3-12' ? '#0284c7' : 'transparent', color: activeProtocol === 'task-3-12' ? '#ffffff' : '#475569', transition: 'all 0.15s ease' }}
          >
            <Target size={12} /> Task 3.12: Kinetic Target Reaching
          </button>
          <button
            onClick={() => onSelectProtocol('task-3-15')}
            style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: activeProtocol === 'task-3-15' ? '#0284c7' : 'transparent', color: activeProtocol === 'task-3-15' ? '#ffffff' : '#475569', transition: 'all 0.15s ease' }}
          >
            Task 3.15: Postural Tremor FFT
          </button>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          
          {/* Viva Defense Guide Button */}
          <button
            onClick={onOpenDefenseGuide}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
            title="Open Judge Viva Defense cheat-sheet and clinical questions"
          >
            <HelpCircle size={13} /> Judge Defense Guide
          </button>

          {/* Audio Sonification Toggle */}
          <button
            onClick={onToggleAudio}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: isAudioMuted ? '#f1f5f9' : '#f0fdf4', color: isAudioMuted ? '#64748b' : '#15803d', border: `1px solid ${isAudioMuted ? '#cbd5e1' : '#bbf7d0'}`, borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {isAudioMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {isAudioMuted ? 'Muted' : 'Acoustic Click'}
          </button>

          {/* Reset Baseline */}
          <button
            onClick={onResetSession}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <RefreshCw size={12} /> Reset
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', background: isFullscreen ? '#0f172a' : '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </button>

          {/* Clinical Diagnostic PDF Report */}
          <button
            onClick={onOpenReport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <FileText size={13} color="#0284c7" /> Report
          </button>

        </div>

      </div>
    </header>
  );
};
