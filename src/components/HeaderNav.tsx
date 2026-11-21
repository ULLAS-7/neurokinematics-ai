import React from 'react';
import { Activity, ShieldCheck, Volume2, VolumeX, Maximize2, Minimize2, FileText, RefreshCw } from 'lucide-react';

interface HeaderNavProps {
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResetSession: () => void;
  onOpenReport: () => void;
  isCameraActive: boolean;
  engineType: string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  isAudioMuted,
  onToggleAudio,
  isFullscreen,
  onToggleFullscreen,
  onResetSession,
  onOpenReport,
  isCameraActive,
  engineType
}) => {
  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
            <Activity size={22} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                NeuroKinematics <span style={{ color: '#0284c7' }}>AI™</span>
              </span>
              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.55rem', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, border: '1px solid #bae6fd', letterSpacing: '0.04em' }}>
                MDS-UPDRS PART III
              </span>
              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.55rem', borderRadius: '4px', background: isCameraActive ? '#f0fdf4' : '#f8fafc', color: isCameraActive ? '#15803d' : '#64748b', fontWeight: 700, border: `1px solid ${isCameraActive ? '#bbf7d0' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck size={12} /> {isCameraActive ? 'LIVE 60 FPS • GPU ACCELERATED' : 'SENSOR STANDBY'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.15rem 0 0 0', lineHeight: 1.3 }}>
              Autonomous 21-Joint 3D Biomechanical Motor Biomarker & Real-Time Tremor FFT Engine
            </p>
          </div>
        </div>

        {/* Real Clinical Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* Audio Sonification Toggle */}
          <button
            onClick={onToggleAudio}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', background: isAudioMuted ? '#f1f5f9' : '#f0fdf4', color: isAudioMuted ? '#64748b' : '#15803d', border: `1px solid ${isAudioMuted ? '#cbd5e1' : '#bbf7d0'}`, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            title="Acoustic click on zero-latency pinch contact"
          >
            {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {isAudioMuted ? 'Audio Muted' : 'Acoustic Click Active'}
          </button>

          {/* Reset Baseline */}
          <button
            onClick={onResetSession}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            title="Reset telemetry counters"
          >
            <RefreshCw size={13} /> Reset Baseline
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: isFullscreen ? '#0f172a' : '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)' }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Camera HUD'}
          </button>

          {/* Clinical Diagnostic PDF Report */}
          <button
            onClick={onOpenReport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <FileText size={14} color="#0284c7" /> Clinical Report
          </button>

        </div>

      </div>
    </header>
  );
};
