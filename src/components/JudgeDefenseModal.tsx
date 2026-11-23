import React from 'react';
import { X, ShieldAlert, Award, Brain, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface JudgeDefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JudgeDefenseModal: React.FC<JudgeDefenseModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: '#ffffff', width: '100%', maxWidth: '860px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', color: '#0f172a' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
              <Brain size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>
                Academic & Clinical Viva Defense Guide
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                Instant Clinical Justifications & Answers to Tough Evaluator Questions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', borderRadius: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
          
          {/* Question 1: The Layperson Fallacy */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Core Viva Defense #1
            </span>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0c4a6e', margin: '0.25rem 0 0.5rem 0' }}>
              Judge: "A normal person seeing someone shake would say Parkinson's... What makes this different?"
            </h3>
            <p style={{ margin: '0 0 0.75rem 0', color: '#334155' }}>
              <strong>Your Master Response:</strong> *"Sir, in clinical neurology, saying 'tremor equals Parkinson's' is the single most common and dangerous diagnostic fallacy:"*
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>
                <strong>70% of people with tremors DO NOT have Parkinson's</strong>: They have Essential Tremor (ET), drug-induced tremor, or cerebellar ataxia. ET is 10× more common than Parkinson's. Giving Parkinson's medication (Levodopa) to an ET patient causes severe toxicity without any benefit.
              </li>
              <li>
                <strong>Up to 30% of Parkinson's patients NEVER TREMBLE</strong>: The Akinetic-Rigid subtype has zero tremor, but severe bradykinesia. Because laypeople only look for tremors, these patients go undiagnosed for 3 to 5 years until 70% of their dopamine neurons are dead.
              </li>
              <li>
                <strong>The Human Eye Cannot Measure Frequency</strong>: To a human, 5 Hz and 9 Hz both look like "shaking". But 4–6 Hz resting tremor = Parkinson's (Subthalamic Nucleus), while 8–12 Hz postural tremor = Essential Tremor. Our AI computes Welch's FFT in &lt;16ms to separate them objectively.
              </li>
            </ul>
          </div>

          {/* Question 2: Cerebellar vs Parkinson's Tremor */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Core Viva Defense #2
            </span>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0 0.5rem 0' }}>
              Judge: "How do you distinguish Parkinson's resting tremor from Cerebellar intention tremor?"
            </h3>
            <p style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>
              <strong>Your Master Response:</strong> *"Through our automated <strong>MDS-UPDRS Task 3.12 (Finger-to-Nose Target Reaching Protocol)</strong>:"*
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>
                In <strong>Parkinson's Disease</strong>, the tremor occurs at rest, but <em>disappears or suppresses during voluntary goal-directed movement</em> toward the target.
              </li>
              <li>
                In <strong>Cerebellar Ataxia</strong>, the hand is steady at rest, but <em>trembles violently only when approaching the target (terminal intention tremor / dysmetria)</em>.
              </li>
              <li>
                Our AI tracks the 3D trajectory error vector in real time to classify cerebellar vs. basal ganglia pathology.
              </li>
            </ul>
          </div>

          {/* Question 3: The Mandatory Bradykinesia Criterion */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Core Viva Defense #3
            </span>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0 0.5rem 0' }}>
              Judge: "What is the true clinical hallmark of Parkinson's if not tremor?"
            </h3>
            <p style={{ margin: 0, color: '#334155' }}>
              <strong>Your Master Response:</strong> *"Under the Movement Disorder Society (MDS) gold-standard criteria, <strong>Bradykinesia (progressive slowness and fatigue) is MANDATORY</strong>. Tremor is only supportive. Our system quantifies the <strong>Sequence Effect</strong>: measuring the exact decremental percentage (e.g. 48% decay) across 10 rapid finger taps, which is physically impossible to measure with the human eye."*
            </p>
          </div>

          {/* Question 4: Wearables vs Vision */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Core Viva Defense #4
            </span>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0 0.5rem 0' }}>
              Judge: "Why not just put a smartwatch or accelerometer glove on the patient?"
            </h3>
            <p style={{ margin: 0, color: '#334155' }}>
              <strong>Your Master Response:</strong> *"A smartwatch adds 50 grams of mass to an elderly patient's hand. In biomechanics, adding mass to a spring-mass-damper system fundamentally alters the natural resonant frequency of the limb (mechanical damping). Sensor gloves have high cost ($1,200), calibration drift, and hygiene barriers. Our computer vision approach is 100% non-contact, costs zero extra hardware, and preserves pure, un-damped physiological dynamics."*
            </p>
          </div>

          {/* Mathematical Equations Card */}
          <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: '8px', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mathematical Rigor Reference
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '0.75rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>1. 3D Euclidean Aperture:</span>
                <p style={{ color: '#34d399', margin: '0.2rem 0' }}>d(t) = √[(x8-x4)² + (y8-y4)² + (z8-z4)²] · α</p>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>2. Welch's FFT Power Spectrum:</span>
                <p style={{ color: '#38bdf8', margin: '0.2rem 0' }}>P(f) = (1/N) |Σ x[n]·w[n]·e^(-j2πfn/fs)|²</p>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>3. Amplitude Decay Index:</span>
                <p style={{ color: '#fbbf24', margin: '0.2rem 0' }}>Decay% = [(A_init - A_recent) / A_init] · 100</p>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>4. Joint Goniometer Flexion:</span>
                <p style={{ color: '#c084fc', margin: '0.2rem 0' }}>θ = arccos[(u·v) / (||u||·||v||)] · (180/π)</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
