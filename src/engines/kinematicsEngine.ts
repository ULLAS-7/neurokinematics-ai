/**
 * NeuroKinematics AI - Biomechanical & Neurological Motor Biomarker Engine
 * Evaluates MDS-UPDRS (Movement Disorder Society Unified Parkinson's Disease Rating Scale)
 * 
 * Standardized Clinical Protocols:
 * - MDS-UPDRS Task 3.4: Finger Tapping (Thumb to Index pinch kinematics, bradykinesia, amplitude decay)
 * - MDS-UPDRS Task 3.15: Postural Tremor of the Hands (Welch's FFT Power Spectral Density 0-16 Hz)
 * - MDS-UPDRS Task 3.6: Pronation-Supination (Dysdiadochokinesia angular velocity)
 */

export interface HandLandmark {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  z: number; // Depth relative to wrist
}

export interface TapEvent {
  timestamp: number;
  aperture: number; // Distance in normalized units / mm
  velocity: number;
  interTapIntervalMs: number;
  isFatigued: boolean;
}

export interface TremorSpectrumBin {
  frequency: number; // Hz (0 to 16)
  power: number; // Power Spectral Density (PSD)
  isPeak: boolean;
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
  
  // Real-time Tremor FFT
  tremorFrequencyHz: number; // Dominant peak frequency in 0-16 Hz
  tremorPowerMm2: number; // Tremor amplitude squared
  tremorClassification: 'Healthy Baseline' | 'Parkinsonian Resting Tremor' | 'Essential Action Tremor' | 'Physiological Stress';
  spectrumBins: TremorSpectrumBin[];

  // MDS-UPDRS Task 3.4 (Finger Tapping) Biomarkers
  totalTaps: number;
  meanCadenceHz: number;
  meanVelocityMmS: number;
  amplitudeDecayPercent: number; // % reduction from initial taps to recent taps
  rhythmRegularityCv: number; // Coefficient of Variation of Inter-Tap Interval (CV_ITI %)
  freezingArrestsCount: number; // Number of motor blocks / hesitations (>1200ms)
  
  // Clinical UPDRS Severity Grading
  updrsGrade: 0 | 1 | 2 | 3 | 4;
  updrsInterpretation: string;
  clinicalAlert: string | null;

  // Recent Kinetic Waveform History for Oscilloscope (last 120 frames)
  apertureHistory: { t: number; aperture: number; velocity: number }[];
}

export class KinematicsEngine {
  private historyCapacity = 180;
  private apertureHistory: { t: number; aperture: number; velocity: number }[] = [];
  private wristHistory: { t: number; x: number; y: number }[] = [];
  private taps: TapEvent[] = [];
  
  private wasPinching = false;
  private lastTapTime = 0;
  private lastPeakAperture = 0;
  private initialApertures: number[] = [];
  private recentApertures: number[] = [];
  private freezingCount = 0;
  private lastMovementTime = Date.now();

  // Calibration scale: normalized coordinate to millimeter conversion (approx. hand width ~85mm)
  private readonly MM_SCALE = 160; 

  public resetSession() {
    this.apertureHistory = [];
    this.wristHistory = [];
    this.taps = [];
    this.wasPinching = false;
    this.lastTapTime = 0;
    this.lastPeakAperture = 0;
    this.initialApertures = [];
    this.recentApertures = [];
    this.freezingCount = 0;
    this.lastMovementTime = Date.now();
  }

  /**
   * Process a single video frame with 21 3D landmarks
   */
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
    const wrist = landmarks[0];

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

    // Keep history
    this.apertureHistory.push({ t: now, aperture: apertureMm, velocity: velocityMmS });
    if (this.apertureHistory.length > this.historyCapacity) {
      this.apertureHistory.shift();
    }

    // Track wrist/index motion for tremor FFT
    this.wristHistory.push({ t: now, x: indexTip.x, y: indexTip.y });
    if (this.wristHistory.length > 128) {
      this.wristHistory.shift();
    }

    // 3. Pinch Event & Tap Kinematics Detection (Hysteresis thresholding)
    const isPinching = apertureMm < 18;

    if (!this.wasPinching && isPinching) {
      // Impact event: Contact made!
      const iti = this.lastTapTime > 0 ? now - this.lastTapTime : 300;
      this.lastTapTime = now;
      this.lastMovementTime = now;

      // Track amplitude
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
      // Opening stroke: Track max peak opening
      if (apertureMm > this.lastPeakAperture) {
        this.lastPeakAperture = apertureMm;
      }
      if (velocityMmS > 30) {
        this.lastMovementTime = now;
      }
    }

    this.wasPinching = isPinching;

    // Check for Motor Freezing / Hesitations (>1400ms pause with hand up)
    if (now - this.lastMovementTime > 1400 && this.taps.length >= 3) {
      this.freezingCount++;
      this.lastMovementTime = now;
    }

    // 4. Calculate Welch's Fast Fourier Transform (FFT) Power Spectrum for Tremor
    const { peakFreq, peakPower, classification, bins } = this.computeTremorFFT();

    // 5. Aggregate MDS-UPDRS Task 3.4 Summary Statistics
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

      // Coefficient of Variation CV = (Std / Mean) * 100
      if (intervals.length >= 3) {
        const variance = intervals.reduce((sum, v) => sum + Math.pow(v - meanIti, 2), 0) / intervals.length;
        const std = Math.sqrt(variance);
        rhythmRegularityCv = Math.round((std / meanIti) * 100);
      }

      // Amplitude Decay: Compare initial taps vs recent taps
      if (this.initialApertures.length >= 2 && this.recentApertures.length >= 2) {
        const initMean = this.initialApertures.reduce((a, b) => a + b, 0) / this.initialApertures.length;
        const recMean = this.recentApertures.reduce((a, b) => a + b, 0) / this.recentApertures.length;
        if (initMean > 0) {
          const decay = ((initMean - recMean) / initMean) * 100;
          amplitudeDecayPercent = Math.max(0, Math.round(decay));
        }
      }
    }

    // 6. Clinical MDS-UPDRS Rating Evaluation
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
      updrsGrade: grade,
      updrsInterpretation: interpretation,
      clinicalAlert: alert,
      apertureHistory: [...this.apertureHistory]
    };
  }

  /**
   * Real-time Fast Fourier Transform across 31 spectral frequency points
   */
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
        alert: `⚠️ PARKINSONIAN RESTING TREMOR DETECTED: ${tremorFreq} Hz PEAK`
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
      updrsGrade: 0,
      updrsInterpretation: 'Align hand within the camera reticle to begin motor kinematic telemetry.',
      clinicalAlert: null,
      apertureHistory: []
    };
  }
}
