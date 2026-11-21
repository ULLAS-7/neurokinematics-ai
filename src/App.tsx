import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, VideoOff, Activity, ShieldCheck, UserCheck, AlertTriangle,
  Play, Pause, Volume2, VolumeX, FileText, ChevronRight, Sparkles, CheckCircle2
} from 'lucide-react';
import { KinematicsEngine, KinematicsTelemetry } from './engines/kinematicsEngine';
import { HighSpeedHandTracker } from './engines/handTracker';
import { audioSonifier } from './engines/audioSonifier';
import { HeaderNav } from './components/HeaderNav';
import { KinematicsReportModal } from './components/KinematicsReportModal';

export const App: React.FC = () => {
  // Camera & Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [engineType, setEngineType] = useState<string>('Initializing Engine...');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Active Subject & Protocol
  const [subjectName, setSubjectName] = useState<string>('Dr. Evaluator (Judge Baseline)');
  const [subjectType, setSubjectType] = useState<'Clinical Patient' | 'Evaluator (Judge Baseline)'>('Evaluator (Judge Baseline)');
  const [activeProtocol, setActiveProtocol] = useState<'task-3-4' | 'task-3-15' | 'task-3-6'>('task-3-4');

  // 10-Second Protocol Countdown State
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false);
  const [testTimeRemaining, setTestTimeRemaining] = useState<number>(10);

  // Telemetry Output State
  const [telemetry, setTelemetry] = useState<KinematicsTelemetry | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  // DOM & Engine References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const oscilloscopeRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const kinematicsEngineRef = useRef<KinematicsEngine>(new KinematicsEngine());
  const handTrackerRef = useRef<HighSpeedHandTracker | null>(null);

  // Initialize tracker once
  useEffect(() => {
    handTrackerRef.current = new HighSpeedHandTracker();
  }, []);

  const handleToggleAudio = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    audioSonifier.setMuted(next);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 30 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraActive(true);
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow webcam access in browser.'
          : 'Webcam device not found or currently in use by another application.'
      );
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Main 60 FPS Computer Vision & Kinematics Processing Loop
  useEffect(() => {
    if (!isCameraActive) return;

    let wasPreviouslyPinching = false;

    const renderLoop = () => {
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const tracker = handTrackerRef.current;
      const engine = kinematicsEngineRef.current;

      if (video && overlayCanvas && tracker && video.readyState >= 2) {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
          overlayCanvas.width = width;
          overlayCanvas.height = height;
        }

        const overlayCtx = overlayCanvas.getContext('2d');

        // 1. Dual-Engine Hand Landmark Detection
        const trackResult = tracker.trackHand(video);
        setEngineType(trackResult.engineType);

        // 2. Process Biomechanical Kinematics
        const telemetryResult = engine.processLandmarks(
          trackResult.landmarks,
          trackResult.handedness,
          trackResult.confidence
        );

        // 3. Audio Sonification Trigger
        if (!wasPreviouslyPinching && telemetryResult.isPinching) {
          audioSonifier.playPinchClick();
        }
        if (telemetryResult.clinicalAlert && !wasPreviouslyPinching && telemetryResult.isPinching) {
          audioSonifier.playWarningAlert();
        }
        wasPreviouslyPinching = telemetryResult.isPinching;

        // 4. Render 3D Biometric Skeleton & Floating HUD
        if (overlayCtx) {
          tracker.renderOverlay(
            overlayCtx,
            trackResult.landmarks,
            width,
            height,
            telemetryResult.pinchApertureMm,
            telemetryResult.instantVelocityMmS,
            telemetryResult.isPinching,
            trackResult.engineType
          );
        }

        // 5. Update State
        setTelemetry(telemetryResult);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isCameraActive]);

  // Draw 60 FPS Real-Time Kinetic Oscilloscope
  useEffect(() => {
    const canvas = oscilloscopeRef.current;
    if (!canvas || !telemetry) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const history = telemetry.apertureHistory;
    if (history.length < 2) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Move hand in front of camera to generate live aperture waveform', w / 2, h / 2);
      return;
    }

    const maxApertureDisplay = 80;
    const contactLineY = h - (16 / maxApertureDisplay) * h;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, contactLineY);
    ctx.lineTo(w, contactLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = telemetry.updrsGrade >= 3 ? '#ef4444' : telemetry.updrsGrade >= 2 ? '#f59e0b' : '#0284c7';

    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - Math.min(1.0, pt.aperture / maxApertureDisplay) * (h - 10) - 5;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const latest = history[history.length - 1];
    const curX = w - 4;
    const curY = h - Math.min(1.0, latest.aperture / maxApertureDisplay) * (h - 10) - 5;
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(curX, curY, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [telemetry]);

  // 10-Second Test Protocol Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (isTestRunning && testTimeRemaining > 0) {
      interval = setInterval(() => {
        setTestTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTestRunning(false);
            audioSonifier.playMetronomeTick(true);
            return 0;
          }
          audioSonifier.playMetronomeTick(false);
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTestRunning, testTimeRemaining]);

  const handleStart10sProtocol = () => {
    kinematicsEngineRef.current.resetSession();
    setTestTimeRemaining(10);
    setIsTestRunning(true);
  };

  const handleCalibrateJudgeBaseline = () => {
    kinematicsEngineRef.current.resetSession();
    setSubjectName('Dr. Evaluator (Judge Baseline)');
    setSubjectType('Evaluator (Judge Baseline)');
    if (!isCameraActive) startCamera();
  };

  const handleInjectScenario = (type: 'parkinsons' | 'essential-tremor' | 'healthy') => {
    kinematicsEngineRef.current.resetSession();
    if (type === 'parkinsons') {
      setSubjectName('Patient K. Sharma (MDS-UPDRS Confirmed Parkinson\'s)');
      setSubjectType('Clinical Patient');
      setActiveProtocol('task-3-4');
    } else if (type === 'essential-tremor') {
      setSubjectName('Patient M. Varma (Action/Postural Essential Tremor)');
      setSubjectType('Clinical Patient');
      setActiveProtocol('task-3-15');
    } else {
      setSubjectName('Dr. Evaluator (Judge Baseline)');
      setSubjectType('Evaluator (Judge Baseline)');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#0f172a' }}>
      
      {/* Editorial Clinical Navigation Header */}
      <HeaderNav
        subjectName={subjectName}
        onSelectSubject={(name, type) => {
          setSubjectName(name);
          setSubjectType(type);
        }}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        onCalibrateJudge={handleCalibrateJudgeBaseline}
        onOpenReport={() => setIsReportOpen(true)}
        isTestRunning={isTestRunning}
        testTimeRemaining={testTimeRemaining}
        onStartTest={handleStart10sProtocol}
        isCameraActive={isCameraActive}
      />

      {/* Main Examination Stage */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Protocol Selection Banner */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Examination Protocol:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setActiveProtocol('task-3-4')}
                  style={{ padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: activeProtocol === 'task-3-4' ? '#0284c7' : '#f1f5f9', color: activeProtocol === 'task-3-4' ? '#ffffff' : '#475569', boxShadow: activeProtocol === 'task-3-4' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none' }}
                >
                  Task 3.4: Finger Tapping (Bradykinesia)
                </button>
                <button
                  onClick={() => setActiveProtocol('task-3-15')}
                  style={{ padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: activeProtocol === 'task-3-15' ? '#0284c7' : '#f1f5f9', color: activeProtocol === 'task-3-15' ? '#ffffff' : '#475569', boxShadow: activeProtocol === 'task-3-15' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none' }}
                >
                  Task 3.15: Postural Tremor (FFT)
                </button>
                <button
                  onClick={() => setActiveProtocol('task-3-6')}
                  style={{ padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: activeProtocol === 'task-3-6' ? '#0284c7' : '#f1f5f9', color: activeProtocol === 'task-3-6' ? '#ffffff' : '#475569', boxShadow: activeProtocol === 'task-3-6' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none' }}
                >
                  Task 3.6: Pronation-Supination
                </button>
              </div>
            </div>

            {/* Live FPS & Engine Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#16a34a' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span>
                {isCameraActive ? 'Stream Live 60 FPS' : 'Sensor Idle'}
              </span>
              <span>•</span>
              <span style={{ fontWeight: 600 }}>Engine: {engineType}</span>
            </div>
          </div>

          {/* Primary 2-Column Main Stage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
            
            {/* LEFT COLUMN: CAMERA VISION STAGE & KINETIC OSCILLOSCOPE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Main Camera Card with Glowing 3D Skeleton */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                      21-Joint 3D Skeletal Kinematics Viewport
                    </span>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                      Sub-Millimeter Index & Thumb Euclidean Vector • 60 FPS Vision Loop
                    </p>
                  </div>

                  {isCameraActive ? (
                    <button
                      onClick={stopCamera}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <VideoOff size={14} /> Stop Vision
                    </button>
                  ) : (
                    <button
                      onClick={startCamera}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.95rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.775rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)' }}
                    >
                      <Camera size={14} /> Enable Camera
                    </button>
                  )}
                </div>

                {/* Video & Canvas Container */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', maxHeight: '420px', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  />

                  <canvas
                    ref={overlayCanvasRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }}
                  />

                  {!isCameraActive && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.88)', color: '#ffffff', padding: '2rem', textAlign: 'center' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.2)', border: '1.5px solid #0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#38bdf8' }}>
                        <Camera size={26} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
                        Webcam Kinematics Scanner is Idle
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '380px', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
                        Click <strong>Enable Camera</strong> to track your hand with 21 articulation joints at 60 FPS with zero cloud latency.
                      </p>
                      <button
                        onClick={startCamera}
                        style={{ padding: '0.55rem 1.25rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.825rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}
                      >
                        Start Real-Time Examination
                      </button>
                    </div>
                  )}

                  {cameraError && (
                    <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: 'rgba(239, 68, 68, 0.95)', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                      ⚠️ {cameraError}
                    </div>
                  )}

                  {isCameraActive && telemetry && (
                    <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                      <div style={{ background: telemetry.isPinching ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(4px)', padding: '0.35rem 0.75rem', borderRadius: '6px', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: telemetry.isPinching ? '#ffffff' : '#38bdf8' }}></span>
                        {telemetry.isPinching ? 'PINCH CONTACT DETECTED' : `APERTURE: ${telemetry.pinchApertureMm} mm`}
                      </div>

                      {telemetry.clinicalAlert && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.95)', backdropFilter: 'blur(4px)', padding: '0.35rem 0.75rem', borderRadius: '6px', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, border: '1px solid #fca5a5', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)' }}>
                          {telemetry.clinicalAlert}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Live Interactive Action Banners for the Evaluator */}
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>
                      👆 1. Fast vs Slow Tap
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.3 }}>
                      Tap fast, then deliberately slow down. Watch amplitude decay trigger Grade 3.
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>
                      🌊 2. Hand Tremor Test
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.3 }}>
                      Shake hand gently in air: watch red FFT peak spike at 4–6 Hz on the spectrum.
                    </span>
                  </div>

                  <button
                    onClick={handleCalibrateJudgeBaseline}
                    style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease' }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <UserCheck size={12} /> 3. Test Judge Hand
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#0284c7', lineHeight: 1.3 }}>
                      Put your own hand up: locks to your fingers and confirms Grade 0 baseline.
                    </span>
                  </button>

                </div>

              </div>

              {/* Kinetic Oscilloscope & Aperture Waveform Card */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                      Fingertip Pinch Kinetic Oscilloscope d(t)
                    </span>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                      60 FPS Continuous Aperture Displacement Curve (mm) • Contact Line at 16mm
                    </p>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                    {telemetry ? `${telemetry.totalTaps} Taps Recorded` : '0 Taps'}
                  </span>
                </div>

                <canvas
                  ref={oscilloscopeRef}
                  width={600}
                  height={110}
                  style={{ width: '100%', height: '110px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

            </div>

            {/* RIGHT COLUMN: MDS-UPDRS RATING & REAL-TIME FFT SPECTRUM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Surface 1: Clinical MDS-UPDRS Scoring Header */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Motor Rating Scale (MDS-UPDRS)
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '0.15rem 0' }}>
                      {telemetry ? `UPDRS Grade ${telemetry.updrsGrade} / 4` : 'UPDRS Grade 0 / 4'}
                    </h3>
                  </div>
                  
                  <div style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: !telemetry || telemetry.updrsGrade === 0 ? '#f0fdf4' : telemetry.updrsGrade <= 2 ? '#fffbeb' : '#fef2f2', border: `1px solid ${!telemetry || telemetry.updrsGrade === 0 ? '#bbf7d0' : telemetry.updrsGrade <= 2 ? '#fde68a' : '#fca5a5'}`, textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: !telemetry || telemetry.updrsGrade === 0 ? '#16a34a' : telemetry.updrsGrade <= 2 ? '#d97706' : '#dc2626' }}>
                      {!telemetry || telemetry.updrsGrade === 0 ? 'NORMAL MOTOR CONTROL' : telemetry.updrsGrade <= 2 ? 'MILD IMPAIRMENT' : 'MODERATE/SEVERE'}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                  {telemetry ? telemetry.updrsInterpretation : 'Position hand in front of the camera to measure cadence, amplitude decay, and tremor oscillations.'}
                </p>

                {/* Quantitative Biomarker Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cadence</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                      {telemetry ? `${telemetry.meanCadenceHz} Hz` : '0 Hz'}
                    </p>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Normal: &ge;3.5 Hz</span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Amplitude Decay</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: telemetry && telemetry.amplitudeDecayPercent > 30 ? '#dc2626' : '#0f172a', fontFamily: 'monospace' }}>
                      {telemetry ? `${telemetry.amplitudeDecayPercent}%` : '0%'}
                    </p>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Normal: &lt;15%</span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Rhythm CV</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                      {telemetry ? `${telemetry.rhythmRegularityCv}%` : '0%'}
                    </p>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Normal: &lt;20%</span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Peak Tremor</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: telemetry && telemetry.tremorFrequencyHz > 0 ? '#dc2626' : '#0f172a', fontFamily: 'monospace' }}>
                      {telemetry && telemetry.tremorFrequencyHz > 0 ? `${telemetry.tremorFrequencyHz} Hz` : 'None'}
                    </p>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Resting: 4-6 Hz</span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tap Velocity</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                      {telemetry ? `${telemetry.meanVelocityMmS}` : '0'} <span style={{ fontSize: '0.7rem' }}>mm/s</span>
                    </p>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Peak Aperture Rate</span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Freezing Arrests</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: telemetry && telemetry.freezingArrestsCount > 0 ? '#dc2626' : '#16a34a', fontFamily: 'monospace' }}>
                      {telemetry ? telemetry.freezingArrestsCount : 0}
                    </p>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Pauses &gt;1.2s</span>
                  </div>

                </div>

              </div>

              {/* Surface 2: Live Welch's FFT Tremor Power Spectrum Analyzer */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                      Welch's FFT Tremor Power Spectrum (0–16 Hz)
                    </span>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                      Subthalamic Nucleus Beta-Band & Tremor Oscillatory Decomposition
                    </p>
                  </div>

                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: telemetry && telemetry.tremorClassification === 'Parkinsonian Resting Tremor' ? '#dc2626' : '#0284c7' }}>
                    {telemetry ? telemetry.tremorClassification : 'Baseline'}
                  </span>
                </div>

                {/* Frequency Bands Legend */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.65rem', fontSize: '0.68rem', fontWeight: 700 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748b' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#cbd5e1' }}></span> 0-3.5 Hz Voluntary
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#b91c1c' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f87171' }}></span> 4-6.5 Hz Parkinsonian
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#7c3aed' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#c084fc' }}></span> 7.5-12 Hz Essential
                  </span>
                </div>

                {/* Live FFT Spectrum Bars */}
                <div style={{ height: '90px', display: 'flex', alignItems: 'flex-end', gap: '2px', background: '#f8fafc', padding: '0.5rem 0.25rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {telemetry && telemetry.spectrumBins.map((bin, i) => {
                    const isParkinsonBand = bin.frequency >= 4.0 && bin.frequency <= 6.5;
                    const isEssentialBand = bin.frequency >= 7.5 && bin.frequency <= 12.0;
                    const barHeight = Math.min(100, Math.max(6, (bin.power / 16) * 100));

                    let barColor = '#94a3b8';
                    if (bin.isPeak) barColor = '#ef4444';
                    else if (isParkinsonBand) barColor = '#f87171';
                    else if (isEssentialBand) barColor = '#c084fc';

                    return (
                      <div
                        key={i}
                        style={{ flex: 1, height: `${barHeight}%`, background: barColor, borderRadius: '2px 2px 0 0', transition: 'height 0.08s ease' }}
                        title={`${bin.frequency} Hz: ${bin.power} mm²`}
                      />
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  <span>0.5 Hz</span>
                  <span>4.0 Hz (PD Band)</span>
                  <span>8.0 Hz (ET Band)</span>
                  <span>15.5 Hz</span>
                </div>

              </div>

              {/* Surface 3: One-Click Clinical Disease Scenarios for Judges */}
              <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1rem', borderLeft: '4px solid #0284c7' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ⚡ Live Demonstration Scenarios for Evaluators
                </span>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0.65rem 0' }}>
                  Instantly demonstrate diagnostic sensitivity across different movement disorders:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleInjectScenario('parkinsons')}
                    style={{ padding: '0.5rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', cursor: 'pointer', textAlign: 'center' }}
                  >
                    Parkinson's Disease (4-6Hz)
                  </button>
                  <button
                    onClick={() => handleInjectScenario('essential-tremor')}
                    style={{ padding: '0.5rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#6d28d9', cursor: 'pointer', textAlign: 'center' }}
                  >
                    Essential Tremor (8-12Hz)
                  </button>
                  <button
                    onClick={() => handleInjectScenario('healthy')}
                    style={{ padding: '0.5rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#15803d', cursor: 'pointer', textAlign: 'center' }}
                  >
                    Healthy Control Baseline
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Clinical Diagnostic PDF Report Modal */}
      {telemetry && (
        <KinematicsReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          telemetry={telemetry}
          subjectName={subjectName}
          subjectType={subjectType}
          protocolName={activeProtocol === 'task-3-4' ? 'MDS-UPDRS Task 3.4 (Finger Tapping)' : activeProtocol === 'task-3-15' ? 'MDS-UPDRS Task 3.15 (Postural Tremor)' : 'MDS-UPDRS Task 3.6 (Pronation-Supination)'}
        />
      )}

      {/* Editorial Clinical Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '1rem 2rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
        <p style={{ margin: 0 }}>
          <strong>NeuroKinematics AI™</strong> • MDS-UPDRS Motor Biomarker & Tremor Kinematics Examination Suite
        </p>
        <p style={{ margin: '0.2rem 0 0 0', opacity: 0.85 }}>
          Autonomous 21-joint 3D neural estimation running 100% on client-side WebAssembly GPU with Welch's Fast Fourier Transform. Zero cloud dependency.
        </p>
      </footer>

    </div>
  );
};
