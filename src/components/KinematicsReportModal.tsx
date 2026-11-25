import React, { useMemo, useState } from 'react';
import { KinematicsTelemetry } from '../engines/kinematicsEngine';
import { Printer, X, Activity, Download } from 'lucide-react';

interface KinematicsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: KinematicsTelemetry;
  subjectName: string;
  subjectType: 'Clinical Patient' | 'Evaluator (Judge Baseline)';
  protocolName: string;
}

export const KinematicsReportModal: React.FC<KinematicsReportModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  subjectName: initialSubjectName,
  subjectType: initialSubjectType,
  protocolName
}) => {
  const [subjectName, setSubjectName] = useState(initialSubjectName);
  const [subjectType, setSubjectType] = useState<'Clinical Patient' | 'Evaluator (Judge Baseline)'>(initialSubjectType);

  const { reportId, acquisitionTime } = useMemo(() => {
    return {
      reportId: `NK-${Date.now().toString().slice(-6)}`,
      acquisitionTime: new Date().toLocaleString()
    };
  }, [isOpen, telemetry.timestamp]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSummary = () => {
    const summaryText = [
      'NEUROKINEMATICS AI - CLINICAL KINEMATIC DIAGNOSTIC REPORT',
      `Report ID: ${reportId}`,
      `Acquisition Time: ${acquisitionTime}`,
      `Subject: ${subjectName} (${subjectType})`,
      `Evaluated Hand: ${telemetry.handedness} Hand`,
      `Protocol: ${protocolName}`,
      '',
      `PRIMARY PREDICTION: ${telemetry.differential.primaryPrediction}`,
      `Clinical Rationale: ${telemetry.differential.clinicalRationale}`,
      `MDS-UPDRS Motor Severity: Grade ${telemetry.updrsGrade} / 4`,
      `Interpretation: ${telemetry.updrsInterpretation}`,
      '',
      '4-CONDITION DIFFERENTIAL MATRIX:',
      `- Idiopathic Parkinson's Disease (IPD): ${telemetry.differential.parkinsonsProb}%`,
      `- Essential Action Tremor (ET): ${telemetry.differential.essentialTremorProb}%`,
      `- Cerebellar Intention Ataxia (CA): ${telemetry.differential.cerebellarAtaxiaProb}%`,
      `- Healthy Physiological Baseline (NL): ${telemetry.differential.healthyBaselineProb}%`,
      '',
      'QUANTITATIVE BIOMARKERS:',
      `- Total Taps Recorded: ${telemetry.totalTaps}`,
      `- Tapping Cadence: ${telemetry.meanCadenceHz} Hz`,
      `- Amplitude Decay (Sequence Effect): ${telemetry.amplitudeDecayPercent}%`,
      `- Rhythm Irregularity (CV_ITI): ${telemetry.rhythmRegularityCv}%`,
      `- Tremor FFT Peak: ${telemetry.tremorFrequencyHz > 0 ? `${telemetry.tremorFrequencyHz} Hz (${telemetry.tremorPowerMm2} mm^2)` : 'None (<1.5 Hz)'} [${telemetry.tremorClassification}]`,
      `- Finger-to-Nose (FNT) Curvature (kappa): ${telemetry.fingerToNose.pathCurvatureIndex.toFixed(2)} (${telemetry.fingerToNose.completedCycles} cycles) [${telemetry.fingerToNose.clinicalSeverity}]`,
      `- Motor Blocks / Freezing Pauses: ${telemetry.freezingArrestsCount}`
    ].join('\n');

    const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportId}_NeuroKinematics_Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="print-report-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="print-report-card" style={{ background: '#ffffff', width: '100%', maxWidth: '840px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        
        {/* Modal Action Header (Non-printable) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Activity size={20} color="#0284c7" />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              MDS-UPDRS &amp; SARA Motor Biomarker Diagnostic Report
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="Patient / Evaluator Name"
              style={{ padding: '0.4rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', color: '#0f172a', width: '165px' }}
            />
            <select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value as 'Clinical Patient' | 'Evaluator (Judge Baseline)')}
              style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', color: '#0f172a', background: '#ffffff' }}
            >
              <option value="Evaluator (Judge Baseline)">Evaluator (Judge)</option>
              <option value="Clinical Patient">Clinical Patient</option>
            </select>
            <button
              onClick={handleDownloadSummary}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              <Download size={14} /> Export TXT
            </button>
            <button
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <Printer size={15} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', borderRadius: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Clinical Document Body */}
        <div style={{ padding: '2rem 2.5rem', color: '#0f172a', fontFamily: 'Inter, -apple-system, sans-serif' }}>
          
          {/* Institutional Letterhead */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                NEUROKINEMATICS AI™
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 700, margin: '0.2rem 0 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Computer-Vision Movement Disorder &amp; Tremor Kinematics Laboratory
              </p>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                MDS-UPDRS Part III &amp; SARA Motor Examination Protocol • Client-Side Neural GPU Acceleration
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-block', padding: '0.25rem 0.6rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                REPORT ID: {reportId}
              </span>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
                Acquisition: {acquisitionTime}
              </p>
            </div>
          </div>

          {/* Subject Demographics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Subject Name</span>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{subjectName}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Subject Profile</span>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#0284c7' }}>{subjectType}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Evaluated Hand</span>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{telemetry.handedness} Hand</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Protocol Tested</span>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{protocolName}</p>
            </div>
          </div>

          {/* Core Diagnostic Outcome Callout */}
          <div style={{ background: telemetry.updrsGrade === 0 && telemetry.differential.primaryPrediction === 'Healthy Physiological Baseline' ? '#f0fdf4' : telemetry.updrsGrade <= 2 && telemetry.differential.primaryPrediction === 'Healthy Physiological Baseline' ? '#fffbeb' : '#fef2f2', border: `1.5px solid ${telemetry.updrsGrade === 0 && telemetry.differential.primaryPrediction === 'Healthy Physiological Baseline' ? '#86efac' : '#fca5a5'}`, borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: telemetry.updrsGrade === 0 && telemetry.differential.primaryPrediction === 'Healthy Physiological Baseline' ? '#15803d' : '#b91c1c' }}>
                Primary Differential Prediction: {telemetry.differential.primaryPrediction}
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '0.2rem 0', color: '#0f172a' }}>
                MDS-UPDRS Motor Severity: Grade {telemetry.updrsGrade} / 4
              </h2>
              <p style={{ fontSize: '0.825rem', color: '#334155', margin: 0, maxWidth: '540px', lineHeight: 1.4 }}>
                {telemetry.differential.clinicalRationale} {telemetry.updrsGrade > 0 ? telemetry.updrsInterpretation : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: telemetry.updrsGrade === 0 ? '#16a34a' : telemetry.updrsGrade <= 2 ? '#d97706' : '#dc2626' }}>
                GRADE {telemetry.updrsGrade}
              </span>
              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, fontWeight: 700 }}>
                {telemetry.updrsGrade === 0 ? 'NORMAL MOTOR CONTROL' : telemetry.updrsGrade <= 2 ? 'MILD MOTOR IMPAIRMENT' : 'MODERATE/SEVERE DEFICIT'}
              </p>
            </div>
          </div>

          {/* 4-Condition Neurological Differential Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Parkinson&apos;s (IPD)</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>{telemetry.differential.parkinsonsProb}%</p>
            </div>
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '0.75rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>Essential Tremor (ET)</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#9333ea', fontFamily: 'monospace' }}>{telemetry.differential.essentialTremorProb}%</p>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Cerebellar Ataxia</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#d97706', fontFamily: 'monospace' }}>{telemetry.differential.cerebellarAtaxiaProb}%</p>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Healthy Baseline</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#16a34a', fontFamily: 'monospace' }}>{telemetry.differential.healthyBaselineProb}%</p>
            </div>
          </div>

          {/* Quantitative Kinematics Biomarker Matrix */}
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
            Quantitative Biomechanical Biomarkers ({telemetry.totalTaps} Total Taps Recorded)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Biomarker Parameter</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Measured Value</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Clinical Reference Range</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Tapping Cadence (Frequency)</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>{telemetry.meanCadenceHz} Hz</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>&ge; 3.5 Hz (Normal reciprocal)</td>
                <td style={{ padding: '0.6rem 0.75rem', color: telemetry.totalTaps < 2 ? '#64748b' : telemetry.meanCadenceHz >= 3.0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {telemetry.totalTaps < 2 ? 'Not Tested (0 Taps)' : telemetry.meanCadenceHz >= 3.5 ? 'Normal' : telemetry.meanCadenceHz >= 2.5 ? 'Mild Slowing' : 'Bradykinesia'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Amplitude Decrement (Fatigue Decay)</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>{telemetry.amplitudeDecayPercent}%</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>&lt; 15% aperture decay</td>
                <td style={{ padding: '0.6rem 0.75rem', color: telemetry.amplitudeDecayPercent < 25 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {telemetry.amplitudeDecayPercent < 15 ? 'Normal' : telemetry.amplitudeDecayPercent < 40 ? 'Mild Fatigue' : 'Severe Hypokinesia'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Rhythm Irregularity (CV of ITI)</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>{telemetry.rhythmRegularityCv}%</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>&lt; 20% Coefficient of Variation</td>
                <td style={{ padding: '0.6rem 0.75rem', color: telemetry.rhythmRegularityCv < 25 ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                  {telemetry.rhythmRegularityCv < 20 ? 'Regular' : 'Dysrhythmic'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Tremor Fast Fourier Peak (PSD)</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>
                  {telemetry.tremorFrequencyHz > 0 ? `${telemetry.tremorFrequencyHz} Hz (${telemetry.tremorPowerMm2} mm²)` : 'None (<1.5 Hz)'}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>Flat PSD baseline (&lt;2 mm²)</td>
                <td style={{ padding: '0.6rem 0.75rem', color: telemetry.tremorClassification === 'Healthy Baseline' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {telemetry.tremorClassification}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Finger-to-Nose (FNT) Path Curvature (κ)</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>
                  κ = {telemetry.fingerToNose.pathCurvatureIndex.toFixed(2)} ({telemetry.fingerToNose.completedCycles} cycles)
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>κ &le; 1.15 (Geodesic coordination)</td>
                <td style={{ padding: '0.6rem 0.75rem', color: telemetry.fingerToNose.pathCurvatureIndex <= 1.15 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {telemetry.fingerToNose.clinicalSeverity}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Motor Blocks / Freezing Pauses</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'monospace' }}>{telemetry.freezingArrestsCount} arrests</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>0 hesitations (&gt;1200ms)</td>
                <td style={{ padding: '0.6rem 0.75rem', color: telemetry.freezingArrestsCount === 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {telemetry.freezingArrestsCount === 0 ? 'Zero Freezing' : 'Freezing Observed'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Neurological Pathophysiological Commentary */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pathophysiological & Basal Ganglia Assessment
            </span>
            <p style={{ fontSize: '0.8rem', color: '#334155', margin: '0.4rem 0 0 0', lineHeight: 1.5 }}>
              {telemetry.updrsGrade === 0
                ? 'Absence of bradykinesia or abnormal tremor oscillations indicates intact nigrostriatal dopaminergic neurotransmission and normal basal ganglia motor loop disinhibition. No evidence of subthalamic nucleus (STN) hyper-synchronization.'
                : telemetry.tremorClassification === 'Parkinsonian Resting Tremor'
                ? 'Prominent 4-6 Hz tremor peak and decremental finger pinch amplitude reflect progressive degeneration of substantia nigra pars compacta dopaminergic projections, leading to uncontrolled STN beta-band oscillatory bursts.'
                : 'Observed motor degradation reflects kinetic dysfunction. Recommend formal clinical correlation with Unified Parkinson\'s Disease Rating Scale (MDS-UPDRS) Part III and neurological evaluation for potential dopaminergic responsiveness (Levodopa challenge).'}
            </p>
          </div>

          {/* Clinical Sign-off & Verification */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '1.5rem', fontSize: '0.75rem', color: '#64748b' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>Autonomous AI Biomarker Telemetry</p>
              <p style={{ margin: '0.2rem 0 0 0' }}>Client-Side 21-Joint 3D MediaPipe Kinematic Extraction</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: '180px', borderBottom: '1px solid #94a3b8', marginBottom: '0.35rem' }}></div>
              <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>Attending Neurologist / Evaluator Signature</p>
              <p style={{ margin: '0.15rem 0 0 0' }}>Clinical Decision Support System</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
