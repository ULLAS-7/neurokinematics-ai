import React from 'react';
import { Activity, ShieldCheck, Volume2, VolumeX, UserCheck, Play, Pause, FileText } from 'lucide-react';

interface HeaderNavProps {
  subjectName: string;
  onSelectSubject: (name: string, type: 'Clinical Patient' | 'Evaluator (Judge Baseline)') => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onCalibrateJudge: () => void;
  onOpenReport: () => void;
  isTestRunning: boolean;
  testTimeRemaining: number;
  onStartTest: () => void;
  isCameraActive: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  subjectName,
  onSelectSubject,
  isAudioMuted,
  onToggleAudio,
  onCalibrateJudge,
  onOpenReport,
  isTestRunning,
  testTimeRemaining,
  onStartTest,
  isCameraActive
}) => {
  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand & Hospital Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
            <Activity size={24} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                NeuroKinematics <span style={{ color: '#0284c7' }}>AI™</span>
              </span>
              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.55rem', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, border: '1px solid #bae6fd', letterSpacing: '0.04em' }}>
                MDS-UPDRS PART III
              </span>
              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.55rem', borderRadius: '4px', background: '#f0fdf4', color: '#15803d', fontWeight: 700, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck size={12} /> 60 FPS GPU-WASM
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.15rem 0 0 0', lineHeight: 1.3 }}>
              Autonomous 21-Joint 3D Computer-Vision Biomechanical Motor Biomarker & Tremor FFT Suite
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* Active Case Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <label htmlFor="subject-select" style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Subject:
            </label>
            <select
              id="subject-select"
              value={subjectName}
              onChange={e => {
                const val = e.target.value;
                if (val.includes('Judge')) {
                  onSelectSubject(val, 'Evaluator (Judge Baseline)');
                } else {
                  onSelectSubject(val, 'Clinical Patient');
                }
              }}
              style={{ background: 'transparent', color: '#0f172a', border: 'none', fontSize: '0.78rem', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
            >
              <option value="Dr. Evaluator (Judge Baseline)">Dr. Evaluator (Judge Baseline - Normal Control)</option>
              <option value="Patient K. Sharma (MDS-UPDRS Severe Parkinson's)">Patient K. Sharma (MDS-UPDRS Severe Parkinson's)</option>
              <option value="Patient M. Varma (Essential Action Tremor)">Patient M. Varma (Essential Action Tremor - 8-12 Hz)</option>
              <option value="Patient S. Patel (Post-Stroke Hemiparesis)">Patient S. Patel (Post-Stroke Motor Deficit)</option>
            </select>
          </div>

          {/* Audio Sonification Toggle */}
          <button
            onClick={onToggleAudio}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', background: isAudioMuted ? '#f1f5f9' : '#f0fdf4', color: isAudioMuted ? '#64748b' : '#15803d', border: `1px solid ${isAudioMuted ? '#cbd5e1' : '#bbf7d0'}`, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            title="Subtle auditory click upon physical pinch contact"
          >
            {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {isAudioMuted ? 'Muted' : 'Acoustic Click'}
          </button>

          {/* 10-Second Test Protocol */}
          <button
            onClick={onStartTest}
            disabled={isTestRunning || !isCameraActive}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', background: isTestRunning ? '#f59e0b' : '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: isCameraActive ? 'pointer' : 'not-allowed', opacity: isCameraActive ? 1 : 0.6 }}
          >
            {isTestRunning ? <Pause size={13} /> : <Play size={13} />}
            {isTestRunning ? `Running: ${testTimeRemaining}s` : '10s Protocol'}
          </button>

          {/* 1-Click Judge Baseline Calibration */}
          <button
            onClick={onCalibrateJudge}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)' }}
          >
            <UserCheck size={14} /> Live Judge Mode
          </button>

          {/* PDF Report Trigger */}
          <button
            onClick={onOpenReport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <FileText size={14} color="#0284c7" /> Report
          </button>

        </div>

      </div>
    </header>
  );
};
