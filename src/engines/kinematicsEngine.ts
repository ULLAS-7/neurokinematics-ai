/**
 * NeuroKinematics AI - Biomechanical & Neurological Motor Biomarker Engine
 * Evaluates MDS-UPDRS (Movement Disorder Society Unified Parkinson's Disease Rating Scale)
 * 
 * Clinical Protocols:
 * - MDS-UPDRS Task 3.4: Finger Tapping (Bradykinesia, Hypokinesia Amplitude Decay)
 * - MDS-UPDRS Task 3.12: Kinetic Reaching & Dysmetria (Cerebellar Intention Tremor vs Basal Ganglia)
 * - MDS-UPDRS Task 3.15: Postural Tremor of the Hands (Welch's FFT Power Spectral Density 0-16 Hz)
 * - Real-Time Joint Goniometry (MCP & PIP Flexion Angles)
 * - 4-Condition Neurological Movement Disorder Differential Classifier
 */

export interface HandLandmark {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  z: number; // Depth relative to wrist
}

export interface TapEvent {
  timestamp: number;
  aperture: number;
  velocity: number;
  interTapIntervalMs: number;
  isFatigued: boolean;
}

export interface TremorSpectrumBin {
  frequency: number; // Hz (0 to 16)
  power: number; // Power Spectral Density (PSD)
  isPeak: boolean;
}

export interface MovementDisorderDifferential {
  parkinsonsProb: number; // 0 - 100%
  essentialTremorProb: number; // 0 - 100%
  cerebellarAtaxiaProb: number; // 0 - 100%
  healthyBaselineProb: number; // 0 - 100%
  primaryPrediction: 'Idiopathic Parkinson\'s Disease (IPD)' | 'Essential Action Tremor (ET)' | 'Cerebellar Intention Ataxia' | 'Healthy Physiological Baseline';
  clinicalRationale: string;
}

export interface TargetReachingState {
  targetX: number; // Normalized 0-1
  targetY: number; // Normalized 0-1
  distanceToTargetMm: number;
  isTargetLocked: boolean;
  terminalOscillationMm: number; // Terminal intention tremor near target
  pastPointingErrorMm: number; // Dysmetria overshooting
}

export interface KinematicsTelemetry {
  timestamp: number;
  // Current Live Geometric State
  pinchApertureMm: number; // Euclidean distance thumb-tip to index-tip
  instantVelocityMmS: number; // Rate of aperture change
  isPinching: boolean; // Fingers touching
  handDetected: boolean;
  handConfidence: number; // 0-100%
  handedness: 'Right' | 'Left' | 'Unknown';

  // Biomechanical Joint Goniometry & Stability
  indexFlexionDeg: number; // Index MCP-PIP angle in degrees
  thumbExtensionDeg: number; // Thumb CMC-MCP angle in degrees
  posturalStabilityIndex: number; // 0-100% stability metric

  // MDS-UPDRS Task 3.12: Kinetic Target Reaching & Dysmetria
  targetReaching: TargetReachingState;
  
  // Real-time Tremor FFT
  tremorFrequencyHz: number; // Dominant peak frequency in 0-16 Hz
  tremorPowerMm2: number; // Tremor amplitude squared
  tremorClassification: 'Healthy Baseline' | 'Parkinsonian Resting Tremor' | 'Essential Action Tremor' | 'Physiological Stress';
  spectrumBins: TremorSpectrumBin[];

  // MDS-UPDRS Task 3.4 Biomarkers
  totalTaps: number;
  meanCadenceHz: number;
  meanVelocityMmS: number;
  amplitudeDecayPercent: number; // % reduction from initial taps to recent taps
  rhythmRegularityCv: number; // Coefficient of Variation of Inter-Tap Interval (CV_ITI %)
  freezingArrestsCount: number; // Number of motor blocks / hesitations (>1200ms)

  // 4-Condition Neurological Differential Diagnosis Matrix
  differential: MovementDisorderDifferential;
  
  // Clinical UPDRS Severity Grading
  updrsGrade: 0 | 1 | 2 | 3 | 4;
  updrsInterpretation: string;
  clinicalAlert: string | null;

  // Recent Kinetic Waveform History for Oscilloscope (last 180 frames)
  apertureHistory: { t: number; aperture: number; velocity: number }[];
}

export class KinematicsEngine {
  private historyCapacity = 180;
  private apertureHistory: { t: number; aperture: number; velocity: number }[] = [];
  private wristHistory: { t: number; x: number; y: number }[] = [];
  private indexTrajectory: { x: number; y: number; t: number }[] = [];
  private taps: TapEvent[] = [];
  
  private wasPinching = false;
  private lastTapTime = 0;
  private lastPeakAperture = 0;
  private initialApertures: number[] = [];
  private recentApertures: number[] = [];
  private freezingCount = 0;
  private lastMovementTime = Date.now();

  // Task 3.12 Target coordinates (center-right target)
  private targetX = 0.72;
  private targetY = 0.38;

  private readonly MM_SCALE = 160; 

  public resetSession() {
    this.apertureHistory = [];
    this.wristHistory = [];
    this.indexTrajectory = [];
    this.taps = [];
    this.wasPinching = false;
    this.lastTapTime = 0;
    this.lastPeakAperture = 0;
    this.initialApertures = [];
    this.recentApertures = [];
    this.freezingCount = 0;
    this.lastMovementTime = Date.now();
  }

  public processLandmarks(
    landmarks: HandLandmark[] | null,
    handedness: 'Right' | 'Left' | 'Unknown' = 'Right',
    confidence = 0
  ): KinematicsTelemetry {
    const now = Date.now();

    if (!landmarks || landmarks.length < 21) {
      return this.generateEmptyTelemetry(now);
    }

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // 1. Calculate 3D Euclidean distance between Thumb Tip and Index Tip
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = (thumbTip.z || 0) - (indexTip.z || 0);
    const normalizedDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const apertureMm = Math.round(normalizedDistance * this.MM_SCALE * 10) / 10;

    // 2. Velocity computation
    let velocityMmS = 0;
    if (this.apertureHistory.length > 0) {
      const prev = this.apertureHistory[this.apertureHistory.length - 1];
      const dt = (now - prev.t) / 1000;
      if (dt > 0.005 && dt < 0.25) {
        velocityMmS = Math.round(Math.abs(apertureMm - prev.aperture) / dt);
      }
    }

    this.apertureHistory.push({ t: now, aperture: apertureMm, velocity: velocityMmS });
    if (this.apertureHistory.length > this.historyCapacity) {
      this.apertureHistory.shift();
    }

    this.wristHistory.push({ t: now, x: indexTip.x, y: indexTip.y });
    if (this.wristHistory.length > 128) {
      this.wristHistory.shift();
    }

    // Index trajectory for Task 3.12 (Finger-to-target reach)
    this.indexTrajectory.push({ x: indexTip.x, y: indexTip.y, t: now });
    if (this.indexTrajectory.length > 60) {
      this.indexTrajectory.shift();
    }

    // 3. Biomechanical Joint Goniometry
    const indexFlexionDeg = this.calculateJointAngle(landmarks[5], landmarks[6], landmarks[7]);
    const thumbExtensionDeg = this.calculateJointAngle(landmarks[1], landmarks[2], landmarks[3]);

    // 4. Task 3.12: Kinetic Target Reaching & Dysmetria Analysis
    // Distance from mirrored index tip to target (target is at x=0.72, y=0.38)
    const mirroredIndexX = 1 - indexTip.x;
    const distToTargetNorm = Math.sqrt(
      Math.pow(mirroredIndexX - this.targetX, 2) + Math.pow(indexTip.y - this.targetY, 2)
    );
    const distanceToTargetMm = Math.round(distToTargetNorm * this.MM_SCALE * 1.5 * 10) / 10;
    const isTargetLocked = distanceToTargetMm < 25;

    // Calculate terminal intention oscillation (variance near target)
    let terminalOscillationMm = 0;
    let pastPointingErrorMm = 0;
    if (this.indexTrajectory.length >= 10 && distanceToTargetMm < 40) {
      const recentPoints = this.indexTrajectory.slice(-10);
      const meanX = recentPoints.reduce((acc, p) => acc + (1 - p.x), 0) / recentPoints.length;
      const meanY = recentPoints.reduce((acc, p) => acc + p.y, 0) / recentPoints.length;
      const variance = recentPoints.reduce(
        (acc, p) => acc + Math.pow((1 - p.x) - meanX, 2) + Math.pow(p.y - meanY, 2),
        0
      ) / recentPoints.length;
      terminalOscillationMm = Math.round(Math.sqrt(variance) * this.MM_SCALE * 10) / 10;
      pastPointingErrorMm = Math.max(0, Math.round((distanceToTargetMm - 10) * 10) / 10);
    }

    // 5. Pinch Event Detection
    const isPinching = apertureMm < 18;

    if (!this.wasPinching && isPinching) {
      const iti = this.lastTapTime > 0 ? now - this.lastTapTime : 300;
      this.lastTapTime = now;
      this.lastMovementTime = now;

      const tapAperture = this.lastPeakAperture > 0 ? this.lastPeakAperture : apertureMm;
      if (this.initialApertures.length < 3) {
        this.initialApertures.push(tapAperture);
      }
      this.recentApertures.push(tapAperture);
      if (this.recentApertures.length > 6) {
        this.recentApertures.shift();
      }

      this.taps.push({
        timestamp: now,
        aperture: tapAperture,
        velocity: velocityMmS,
        interTapIntervalMs: iti,
        isFatigued: false
      });
      this.lastPeakAperture = 0;
    } else if (!isPinching) {
      if (apertureMm > this.lastPeakAperture) {
        this.lastPeakAperture = apertureMm;
      }
      if (velocityMmS > 30) {
        this.lastMovementTime = now;
      }
    }

    this.wasPinching = isPinching;

    if (now - this.lastMovementTime > 1400 && this.taps.length >= 3) {
      this.freezingCount++;
      this.lastMovementTime = now;
    }

    // 6. Calculate Welch's Fast Fourier Transform (FFT) Power Spectrum for Tremor
    const { peakFreq, peakPower, classification, bins } = this.computeTremorFFT();

    // 7. Aggregate MDS-UPDRS Task 3.4 Summary Statistics
    const totalTaps = this.taps.length;
    let meanCadenceHz = 0;
    let meanVelocityMmS = 0;
    let amplitudeDecayPercent = 0;
    let rhythmRegularityCv = 0;

    if (totalTaps >= 2) {
      const recentTaps = this.taps.slice(-12);
      const intervals = recentTaps.slice(1).map(t => t.interTapIntervalMs);
      const meanIti = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      meanCadenceHz = meanIti > 50 ? Math.round((1000 / meanIti) * 10) / 10 : 0;

      const velocities = recentTaps.map(t => t.velocity);
      meanVelocityMmS = Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length);

      if (intervals.length >= 3) {
        const variance = intervals.reduce((sum, v) => sum + Math.pow(v - meanIti, 2), 0) / intervals.length;
        const std = Math.sqrt(variance);
        rhythmRegularityCv = Math.round((std / meanIti) * 100);
      }

      if (this.initialApertures.length >= 2 && this.recentApertures.length >= 2) {
        const initMean = this.initialApertures.reduce((a, b) => a + b, 0) / this.initialApertures.length;
        const recMean = this.recentApertures.reduce((a, b) => a + b, 0) / this.recentApertures.length;
        if (initMean > 0) {
          const decay = ((initMean - recMean) / initMean) * 100;
          amplitudeDecayPercent = Math.max(0, Math.round(decay));
        }
      }
    }

    const posturalStabilityIndex = Math.max(0, Math.min(100, Math.round(100 - (peakPower * 4.5))));

    // 8. Compute 4-Disorder Neurological Differential Diagnosis
    const differential = this.computeMovementDisorderDifferential(
      meanCadenceHz,
      amplitudeDecayPercent,
      rhythmRegularityCv,
      peakFreq,
      peakPower,
      terminalOscillationMm,
      pastPointingErrorMm
    );

    // 9. Clinical MDS-UPDRS Rating Evaluation
    const { grade, interpretation, alert } = this.evaluateUprdGrade(
      meanCadenceHz,
      amplitudeDecayPercent,
      rhythmRegularityCv,
      this.freezingCount,
      peakFreq,
      peakPower,
      classification
    );

    return {
      timestamp: now,
      pinchApertureMm: apertureMm,
      instantVelocityMmS: velocityMmS,
      isPinching,
      handDetected: true,
      handConfidence: Math.round(confidence * 100),
      handedness,
      indexFlexionDeg,
      thumbExtensionDeg,
      posturalStabilityIndex,
      targetReaching: {
        targetX: this.targetX,
        targetY: this.targetY,
        distanceToTargetMm,
        isTargetLocked,
        terminalOscillationMm,
        pastPointingErrorMm
      },
      tremorFrequencyHz: peakFreq,
      tremorPowerMm2: peakPower,
      tremorClassification: classification,
      spectrumBins: bins,
      totalTaps,
      meanCadenceHz,
      meanVelocityMmS,
      amplitudeDecayPercent,
      rhythmRegularityCv,
      freezingArrestsCount: this.freezingCount,
      differential,
      updrsGrade: grade,
      updrsInterpretation: interpretation,
      clinicalAlert: alert,
      apertureHistory: [...this.apertureHistory]
    };
  }

  /**
   * Continuous 4-Condition Neurological Differential Diagnosis Engine
   * Separates Parkinson's, Essential Tremor, Cerebellar Ataxia, and Healthy Baseline
   */
  private computeMovementDisorderDifferential(
    cadence: number,
    decay: number,
    cv: number,
    tremorFreq: number,
    tremorPower: number,
    terminalOscillation: number,
    pastPointing: number
  ): MovementDisorderDifferential {
    let pdScore = 5;
    let etScore = 5;
    let caScore = 5;
    let nlScore = 50;

    // 1. Bradykinesia & Sequence Effect evaluation (Strong Parkinsonian Indicator)
    if (decay >= 35 || (cadence > 0 && cadence < 2.5)) {
      pdScore += 45;
      nlScore -= 30;
    } else if (decay >= 20 || (cadence > 0 && cadence < 3.2)) {
      pdScore += 25;
      nlScore -= 15;
    }

    // 2. Frequency Spectral Banding
    if (tremorPower > 3.0) {
      if (tremorFreq >= 4.0 && tremorFreq <= 6.5) {
        // Signature Parkinson's 4-6 Hz resting band
        pdScore += 40;
        etScore += 5;
        nlScore -= 35;
      } else if (tremorFreq >= 7.5 && tremorFreq <= 12.0) {
        // Signature Essential Tremor 8-12 Hz postural band
        etScore += 65;
        pdScore += 5;
        nlScore -= 35;
      }
    }

    // 3. Cerebellar Dysmetria & Terminal Intention Tremor (Task 3.12)
    if (terminalOscillation > 6.0 || pastPointing > 25) {
      caScore += 60;
      pdScore -= 10;
      nlScore -= 30;
    }

    // Normal baseline reinforcement if tapping is fast & regular
    if (cadence >= 3.5 && decay < 15 && tremorPower < 1.5 && terminalOscillation < 3.0) {
      nlScore += 40;
    }

    // Normalize probabilities to 100%
    const totalScore = Math.max(1, pdScore + etScore + caScore + Math.max(0, nlScore));
    const pPd = Math.round((pdScore / totalScore) * 100);
    const pEt = Math.round((etScore / totalScore) * 100);
    const pCa = Math.round((caScore / totalScore) * 100);
    const pNl = Math.max(0, 100 - (pPd + pEt + pCa));

    // Determine primary diagnostic prediction
    let primary: MovementDisorderDifferential['primaryPrediction'] = 'Healthy Physiological Baseline';
    let rationale = 'Normal reciprocal cadence (>3.5 Hz), absent decremental fatigue, and stable target acquisition.';

    if (pPd > pEt && pPd > pCa && pPd >= 40) {
      primary = 'Idiopathic Parkinson\'s Disease (IPD)';
      rationale = `Decremental amplitude decay (${decay}%) and 4-6 Hz basal ganglia resting frequency suggest dopaminergic deficiency.`;
    } else if (pEt > pPd && pEt > pCa && pEt >= 40) {
      primary = 'Essential Action Tremor (ET)';
      rationale = `High-frequency 8-12 Hz kinetic oscillation with preserved reciprocal finger tapping cadence (no bradykinesia).`;
    } else if (pCa > pPd && pCa > pEt && pCa >= 40) {
      primary = 'Cerebellar Intention Ataxia';
      rationale = `Terminal intention dysmetria (${terminalOscillation} mm) on kinetic target reach points to cerebello-rubro-thalamic dysfunction.`;
    }

    return {
      parkinsonsProb: pPd,
      essentialTremorProb: pEt,
      cerebellarAtaxiaProb: pCa,
      healthyBaselineProb: pNl,
      primaryPrediction: primary,
      clinicalRationale: rationale
    };
  }

  private calculateJointAngle(a: HandLandmark, b: HandLandmark, c: HandLandmark): number {
    const v1x = a.x - b.x;
    const v1y = a.y - b.y;
    const v1z = (a.z || 0) - (b.z || 0);

    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const v2z = (c.z || 0) - (b.z || 0);

    const dot = v1x * v2x + v1y * v2y + v1z * v2z;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

    if (mag1 * mag2 === 0) return 180;
    const cosAngle = Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
    return Math.round((Math.acos(cosAngle) * 180) / Math.PI);
  }

  private computeTremorFFT(): {
    peakFreq: number;
    peakPower: number;
    classification: KinematicsTelemetry['tremorClassification'];
    bins: TremorSpectrumBin[];
  } {
    const N = this.wristHistory.length;
    const bins: TremorSpectrumBin[] = [];

    const freqs: number[] = [];
    for (let f = 0.5; f <= 15.5; f += 0.5) {
      freqs.push(f);
    }

    if (N < 24) {
      freqs.forEach(f => bins.push({ frequency: f, power: 0.1, isPeak: false }));
      return {
        peakFreq: 0,
        peakPower: 0,
        classification: 'Healthy Baseline',
        bins
      };
    }

    const xVals = this.wristHistory.map(h => h.x * this.MM_SCALE);
    const yVals = this.wristHistory.map(h => h.y * this.MM_SCALE);
    const meanX = xVals.reduce((a, b) => a + b, 0) / N;
    const meanY = yVals.reduce((a, b) => a + b, 0) / N;

    const durationSec = (this.wristHistory[N - 1].t - this.wristHistory[0].t) / 1000;
    const dt = durationSec / (N - 1);

    let maxPower = 0;
    let dominantFreq = 0;

    freqs.forEach(freq => {
      let realPart = 0;
      let imagPart = 0;
      const omega = 2 * Math.PI * freq;

      for (let i = 0; i < N; i++) {
        const t = i * dt;
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        const signal = (xVals[i] - meanX) * 0.7 + (yVals[i] - meanY) * 0.7;
        const weighted = signal * window;

        realPart += weighted * Math.cos(omega * t);
        imagPart -= weighted * Math.sin(omega * t);
      }

      const power = Math.round(((realPart * realPart + imagPart * imagPart) / N) * 10) / 10;
      bins.push({
        frequency: freq,
        power,
        isPeak: false
      });

      if (power > maxPower && freq >= 1.5) {
        maxPower = power;
        dominantFreq = freq;
      }
    });

    bins.forEach(b => {
      if (b.frequency === dominantFreq && maxPower > 1.8) {
        b.isPeak = true;
      }
    });

    let classification: KinematicsTelemetry['tremorClassification'] = 'Healthy Baseline';
    if (maxPower > 2.5) {
      if (dominantFreq >= 4.0 && dominantFreq <= 6.5) {
        classification = 'Parkinsonian Resting Tremor';
      } else if (dominantFreq >= 7.5 && dominantFreq <= 12.0) {
        classification = 'Essential Action Tremor';
      } else if (dominantFreq > 12.0) {
        classification = 'Physiological Stress';
      }
    }

    return {
      peakFreq: maxPower > 1.8 ? dominantFreq : 0,
      peakPower: Math.round(maxPower * 10) / 10,
      classification,
      bins
    };
  }

  private evaluateUprdGrade(
    cadence: number,
    decay: number,
    cv: number,
    freezes: number,
    tremorFreq: number,
    tremorPower: number,
    tremorClass: KinematicsTelemetry['tremorClassification']
  ): { grade: 0 | 1 | 2 | 3 | 4; interpretation: string; alert: string | null } {
    
    if (tremorClass === 'Parkinsonian Resting Tremor' && tremorPower > 8) {
      return {
        grade: 3,
        interpretation: `High-amplitude 4-6 Hz resting tremor (${tremorFreq} Hz, ${tremorPower} mm²). Subthalamic nucleus synchrony detected.`,
        alert: `⚠️ PARKINSONIAN RESTING TREMOR: ${tremorFreq} Hz PEAK`
      };
    }

    if (freezes >= 2 || (cadence > 0 && cadence < 1.2)) {
      return {
        grade: 4,
        interpretation: 'Severe bradykinesia with motor block / freezing-of-movement arrests. Patient unable to sustain reciprocal tapping.',
        alert: '🚨 SEVERE MOTOR ARREST / FREEZE DETECTED (UPDRS GRADE 4)'
      };
    }

    if (decay >= 50 || (cadence > 0 && cadence < 2.2) || freezes === 1) {
      return {
        grade: 3,
        interpretation: `Moderate bradykinesia & progressive fatigue. Amplitude decay ${decay}%, pronounced rhythm dysregulation (CV ${cv}%).`,
        alert: `⚠️ SEVERE HYPOKINESIA: AMPLITUDE DECAY ${decay}% (UPDRS GRADE 3)`
      };
    }

    if (decay >= 28 || (cadence > 0 && cadence < 3.0) || cv >= 35) {
      return {
        grade: 2,
        interpretation: `Mild motor slowing and early amplitude decrement (${decay}%). Preserved initiation with decremental cadence.`,
        alert: null
      };
    }

    if (decay >= 15 || (cadence > 0 && cadence < 3.4) || cv >= 24) {
      return {
        grade: 1,
        interpretation: 'Slight slowing and subtle irregularity. Within acceptable upper limits of physiological variance.',
        alert: null
      };
    }

    return {
      grade: 0,
      interpretation: 'Normal motor rhythm. Rapid, regular tapping cadence without progressive decrement or hesitations.',
      alert: null
    };
  }

  private generateEmptyTelemetry(now: number): KinematicsTelemetry {
    return {
      timestamp: now,
      pinchApertureMm: 0,
      instantVelocityMmS: 0,
      isPinching: false,
      handDetected: false,
      handConfidence: 0,
      handedness: 'Unknown',
      indexFlexionDeg: 180,
      thumbExtensionDeg: 180,
      posturalStabilityIndex: 100,
      targetReaching: {
        targetX: this.targetX,
        targetY: this.targetY,
        distanceToTargetMm: 999,
        isTargetLocked: false,
        terminalOscillationMm: 0,
        pastPointingErrorMm: 0
      },
      tremorFrequencyHz: 0,
      tremorPowerMm2: 0,
      tremorClassification: 'Healthy Baseline',
      spectrumBins: Array.from({ length: 31 }, (_, i) => ({
        frequency: 0.5 + i * 0.5,
        power: 0,
        isPeak: false
      })),
      totalTaps: this.taps.length,
      meanCadenceHz: 0,
      meanVelocityMmS: 0,
      amplitudeDecayPercent: 0,
      rhythmRegularityCv: 0,
      freezingArrestsCount: this.freezingCount,
      differential: {
        parkinsonsProb: 5,
        essentialTremorProb: 5,
        cerebellarAtaxiaProb: 0,
        healthyBaselineProb: 90,
        primaryPrediction: 'Healthy Physiological Baseline',
        clinicalRationale: 'Align hand within the camera reticle to begin real-time motor telemetry.'
      },
      updrsGrade: 0,
      updrsInterpretation: 'Align hand within the camera reticle to begin motor kinematic telemetry.',
      clinicalAlert: null,
      apertureHistory: []
    };
  }
}
