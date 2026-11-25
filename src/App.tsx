import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, VideoOff, Activity, ShieldCheck, Maximize2, Minimize2,
  Volume2, VolumeX, FileText, RefreshCw, AlertTriangle, CheckCircle2, ChevronRight, Target, Timer
} from 'lucide-react';
import { KinematicsEngine, KinematicsTelemetry } from './engines/kinematicsEngine';
import { HighSpeedHandTracker } from './engines/handTracker';
import { audioSonifier } from './engines/audioSonifier';
import { HeaderNav } from './components/HeaderNav';
import { KinematicsReportModal } from './components/KinematicsReportModal';
import { JudgeDefenseModal } from './components/JudgeDefenseModal';

export const App: React.FC = () => {
  // Camera & Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [engineType, setEngineType] = useState<string>('Initializing Engine...');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active Examination Protocol
  const [activeProtocol, setActiveProtocol] = useState<'task-3-4' | 'task-3-12' | 'task-3-15'>('task-3-4');

  // Modals & 10-Second Timed Clinical Trial State
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [reportSnapshot, setReportSnapshot] = useState<KinematicsTelemetry | null>(null);
  const [isDefenseModalOpen, setIsDefenseModalOpen] = useState<boolean>(false);
  const [isTrialRunning, setIsTrialRunning] = useState<boolean>(false);
  const [trialRemainingSec, setTrialRemainingSec] = useState<number>(10);
  const trialStartTimestampRef = useRef<number>(0);
  const midpointChimedRef = useRef<boolean>(false);

  // Raw Landmark Coordinates for Live Transparency Inspector
  const [rawCoordinates, setRawCoordinates] = useState<{
    thumbTip: { x: number; y: number; z: number };
    indexTip: { x: number; y: number; z: number };
    wrist: { x: number; y: number; z: number };
    noseTip: { x: number; y: number; z: number };
    fps: number;
  }>({
    thumbTip: { x: 0, y: 0, z: 0 },
    indexTip: { x: 0, y: 0, z: 0 },
    wrist: { x: 0, y: 0, z: 0 },
    noseTip: { x: 0.5, y: 0.32, z: 0 },
    fps: 60
  });

  // Telemetry Output State
  const [telemetry, setTelemetry] = useState<KinematicsTelemetry | null>(null);

  // DOM References
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const oscilloscopeRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const kinematicsEngineRef = useRef<KinematicsEngine>(new KinematicsEngine());
  const handTrackerRef = useRef<HighSpeedHandTracker | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    handTrackerRef.current = new HighSpeedHandTracker();
  }, []);

  // Keyboard shortcut: Press 'F' for Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mainContainerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const handleToggleAudio = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    audioSonifier.setMuted(next);
  };

  const handleResetSession = () => {
    setIsTrialRunning(false);
    setTrialRemainingSec(10);
    kinematicsEngineRef.current.resetSession();
    setTelemetry(null);
    setReportSnapshot(null);
  };

  const handleOpenReport = () => {
    setReportSnapshot(kinematicsEngineRef.current.getSessionReportTelemetry(false, activeProtocol));
    setIsReportOpen(true);
  };

  const handleStartTimedTrial = () => {
    setReportSnapshot(null);
    setIsReportOpen(false);
    kinematicsEngineRef.current.startTimedTrial(10000);
    trialStartTimestampRef.current = Date.now();
    midpointChimedRef.current = false;
    setTrialRemainingSec(10);
    setIsTrialRunning(true);
    audioSonifier.playMetronomeTick(true);
  };

  const handleCancelTimedTrial = () => {
    setIsTrialRunning(false);
    setTrialRemainingSec(10);
    kinematicsEngineRef.current.cancelTimedTrial();
  };

  // 10-Second Clinical Trial Countdown & Auto-Report Validation Trigger
  useEffect(() => {
    if (!isTrialRunning) return;

    const timerId = window.setInterval(() => {
      const elapsedMs = Date.now() - trialStartTimestampRef.current;
      const remaining = Math.max(0, 10 - elapsedMs / 1000);
      setTrialRemainingSec(Math.round(remaining * 10) / 10);

      // Halfway Epoch transition chime at 5.0s
      if (elapsedMs >= 5000 && !midpointChimedRef.current) {
        midpointChimedRef.current = true;
        audioSonifier.playTargetLock();
      }

      if (remaining <= 0) {
        window.clearInterval(timerId);
        setIsTrialRunning(false);
        setTrialRemainingSec(0);
        audioSonifier.playCycleSuccess();
        const validated = kinematicsEngineRef.current.getSessionReportTelemetry(true, activeProtocol);
        setReportSnapshot(validated);
        setIsReportOpen(true);
      }
    }, 100);

    return () => window.clearInterval(timerId);
  }, [isTrialRunning]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
          ? 'Camera permission denied. Allow camera access in browser settings.'
          : 'Webcam device not found or in use by another software.'
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

  // 60 FPS Real-Time Computer Vision & Kinematics Processing Loop
  useEffect(() => {
    if (!isCameraActive) return;

    let wasPreviouslyPinching = false;
    let wasTargetPreviouslyLocked = false;
    let wasNosePreviouslyTouching = false;
    let previousCycles = 0;

    const renderLoop = () => {
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const tracker = handTrackerRef.current;
      const engine = kinematicsEngineRef.current;

      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        const liveFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
        setRawCoordinates(prev => ({ ...prev, fps: liveFps }));
      }

      if (video && overlayCanvas && tracker && video.readyState >= 2) {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
          overlayCanvas.width = width;
          overlayCanvas.height = height;
        }

        const overlayCtx = overlayCanvas.getContext('2d');

        // 1. Live Optical / MediaPipe Hand & Face Tracking
        const trackResult = tracker.trackHand(video);
        setEngineType(trackResult.engineType);

        // 2. Process Real Kinematics with Biomechanical Goniometry & Finger-to-Nose Protocol
        const telemetryResult = engine.processLandmarks(
          trackResult.landmarks,
          trackResult.handedness,
          trackResult.confidence,
          trackResult.noseLandmark,
          activeProtocol
        );

        // 3. Update Raw Real-Time Coordinates for Live Inspector
        if (trackResult.noseLandmark) {
          const nose = trackResult.noseLandmark;
          setRawCoordinates(prev => ({
            ...prev,
            noseTip: { x: Math.round(nose.x * 1000) / 1000, y: Math.round(nose.y * 1000) / 1000, z: Math.round((nose.z || 0) * 1000) / 1000 }
          }));
        }

        if (trackResult.landmarks && trackResult.landmarks.length >= 21) {
          const t = trackResult.landmarks[4];
          const idx = trackResult.landmarks[8];
          const w = trackResult.landmarks[0];
          setRawCoordinates(prev => ({
            ...prev,
            thumbTip: { x: Math.round(t.x * 1000) / 1000, y: Math.round(t.y * 1000) / 1000, z: Math.round((t.z || 0) * 1000) / 1000 },
            indexTip: { x: Math.round(idx.x * 1000) / 1000, y: Math.round(idx.y * 1000) / 1000, z: Math.round((idx.z || 0) * 1000) / 1000 },
            wrist: { x: Math.round(w.x * 1000) / 1000, y: Math.round(w.y * 1000) / 1000, z: Math.round((w.z || 0) * 1000) / 1000 }
          }));
        }

        // 4. Acoustic Sonification on Pinch Contact, Nose Touch, Target Lock or Completed Cycle
        if (!wasPreviouslyPinching && telemetryResult.isPinching) {
          audioSonifier.playPinchClick();
        }
        if (activeProtocol === 'task-3-12') {
          if (!wasNosePreviouslyTouching && telemetryResult.fingerToNose.isNoseTouching) {
            audioSonifier.playNoseContact();
          }
          if (!wasTargetPreviouslyLocked && telemetryResult.fingerToNose.isTargetTouching) {
            audioSonifier.playTargetLock();
          }
          if (telemetryResult.fingerToNose.completedCycles > previousCycles) {
            audioSonifier.playCycleSuccess();
            previousCycles = telemetryResult.fingerToNose.completedCycles;
          }
          wasNosePreviouslyTouching = telemetryResult.fingerToNose.isNoseTouching;
          wasTargetPreviouslyLocked = telemetryResult.fingerToNose.isTargetTouching;
        } else {
          if (!wasTargetPreviouslyLocked && telemetryResult.targetReaching.isTargetLocked) {
            audioSonifier.playMetronomeTick(true);
          }
          wasTargetPreviouslyLocked = telemetryResult.targetReaching.isTargetLocked;
        }

        if (telemetryResult.clinicalAlert && !wasPreviouslyPinching && telemetryResult.isPinching) {
          audioSonifier.playWarningAlert();
        }
        wasPreviouslyPinching = telemetryResult.isPinching;

        // 5. Render Glowing 3D Biometric Skeleton & Dual Reticle Overlay
        if (overlayCtx) {
          tracker.renderOverlay(
            overlayCtx,
            trackResult.landmarks,
            width,
            height,
            telemetryResult.pinchApertureMm,
            telemetryResult.instantVelocityMmS,
            telemetryResult.isPinching,
            telemetryResult.indexFlexionDeg,
            telemetryResult.targetReaching,
            activeProtocol === 'task-3-12',
            telemetryResult.fingerToNose
          );
        }

        // 6. Update Telemetry State
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
  }, [isCameraActive, activeProtocol]);

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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 18) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const history = telemetry.apertureHistory;
    if (history.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Move hand in front of camera to generate live aperture curve', w / 2, h / 2);
      return;
    }

    const maxApertureDisplay = 80;
    const contactLineY = h - (16 / maxApertureDisplay) * h;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, contactLineY);
    ctx.lineTo(w, contactLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = telemetry.updrsGrade >= 3 ? '#ef4444' : telemetry.updrsGrade >= 2 ? '#f59e0b' : '#38bdf8';

    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - Math.min(1.0, pt.aperture / maxApertureDisplay) * (h - 8) - 4;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const latest = history[history.length - 1];
    const curX = w - 4;
    const curY = h - Math.min(1.0, latest.aperture / maxApertureDisplay) * (h - 8) - 4;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(curX, curY, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [telemetry]);

  return (
    <div
      ref={mainContainerRef}
      className="app-root-shell"
      style={{
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#090d16',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif'
      }}
    >

      {/* Top Clinical Navigation Bar */}
      <div className="no-print">
        <HeaderNav
          isAudioMuted={isAudioMuted}
          onToggleAudio={handleToggleAudio}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onResetSession={handleResetSession}
          onOpenReport={handleOpenReport}
          onOpenDefenseGuide={() => setIsDefenseModalOpen(true)}
          isCameraActive={isCameraActive}
          engineType={engineType}
          activeProtocol={activeProtocol}
          onSelectProtocol={setActiveProtocol}
        />
      </div>

      {/* FULLSCREEN HERO CAMERA VIEWPORT */}
      <div className="no-print" style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%', height: 'calc(100vh - 65px)', overflow: 'hidden', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Mirrored Video Feed with Clean Object-Fit Contain */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }}
        />

        {/* 60 FPS 21-Joint Biometric Skeleton Overlay Canvas (Coordinates mathematically mirrored!) */}
        <canvas
          ref={overlayCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', objectFit: 'contain' }}
        />

        {/* IDLE HERO STATE */}
        {!isCameraActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.88) 0%, rgba(2, 6, 23, 0.98) 100%)', color: '#ffffff', padding: '1.5rem', textAlign: 'center', zIndex: 10 }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.15)', border: '2px solid #0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#38bdf8', boxShadow: '0 0 30px rgba(2, 132, 199, 0.4)' }}>
              <Camera size={30} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.4rem 0', letterSpacing: '-0.02em' }}>
              Autonomous 3D Motor Kinematics Scanner
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '480px', margin: '0 0 1.5rem 0', lineHeight: 1.45 }}>
              60 FPS GPU-accelerated motion capture. Evaluates bradykinesia sequence effects, 4-condition movement disorder differential probabilities, and cerebellar dysmetria.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={startCamera}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(2, 132, 199, 0.5)' }}
              >
                <Camera size={16} /> Enable Fullscreen Camera
              </button>
            </div>
          </div>
        )}

        {/* Camera Permission Error Banner */}
        {cameraError && (
          <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(220, 38, 38, 0.95)', color: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            ⚠️ {cameraError}
          </div>
        )}

        {/* =========================================================================
            RESPONSIVE FLOATING CLINICAL HUD PANELS
            ========================================================================= */}
        {isCameraActive && (
          <>
            {/* 1. TOP-LEFT HUD: LIVE RAW 3D COORDINATE TELEMETRY STREAM */}
            <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '0.75rem 1rem', width: '270px', pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Live 3D Telemetry
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                  ● {rawCoordinates.fps} FPS • &lt;16ms
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Thumb(J4):</span>
                  <span>{rawCoordinates.thumbTip.x.toFixed(3)}, {rawCoordinates.thumbTip.y.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>Index(J8):</span>
                  <span>{rawCoordinates.indexTip.x.toFixed(3)}, {rawCoordinates.indexTip.y.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Wrist(J0):</span>
                  <span>{rawCoordinates.wrist.x.toFixed(3)}, {rawCoordinates.wrist.y.toFixed(3)}</span>
                </div>
                {activeProtocol === 'task-3-12' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                    <span style={{ fontWeight: 700 }}>Nose(N0):</span>
                    <span>{rawCoordinates.noseTip.x.toFixed(3)}, {rawCoordinates.noseTip.y.toFixed(3)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.25rem', marginTop: '0.15rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: telemetry?.isPinching ? '#10b981' : '#ffffff' }}>
                  <span>Pinch Aperture:</span>
                  <span>{telemetry ? `${telemetry.pinchApertureMm} mm` : '0 mm'}</span>
                </div>
              </div>
            </div>

            {/* 2. TOP-RIGHT HUD: 4-WAY NEUROLOGICAL DIFFERENTIAL DIAGNOSTIC MATRIX */}
            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '0.75rem 1rem', width: '305px', pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  4-Disorder Differential Matrix
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase' }}>
                  Continuous Baye
                </span>
              </div>

              {/* Differential Probabilities Progress Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>

                {/* Parkinson's Disease (IPD) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', fontWeight: 700, color: '#f87171' }}>
                    <span>Idiopathic Parkinson's (IPD)</span>
                    <span style={{ fontFamily: 'monospace' }}>{telemetry ? `${telemetry.differential.parkinsonsProb}%` : '5%'}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: `${telemetry ? telemetry.differential.parkinsonsProb : 5}%`, height: '100%', background: '#ef4444', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

                {/* Essential Tremor (ET) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', fontWeight: 700, color: '#c084fc' }}>
                    <span>Essential Action Tremor (ET)</span>
                    <span style={{ fontFamily: 'monospace' }}>{telemetry ? `${telemetry.differential.essentialTremorProb}%` : '5%'}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: `${telemetry ? telemetry.differential.essentialTremorProb : 5}%`, height: '100%', background: '#a855f7', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

                {/* Cerebellar Ataxia (CA) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', fontWeight: 700, color: '#fbbf24' }}>
                    <span>Cerebellar Intention Ataxia</span>
                    <span style={{ fontFamily: 'monospace' }}>{telemetry ? `${telemetry.differential.cerebellarAtaxiaProb}%` : '0%'}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: `${telemetry ? telemetry.differential.cerebellarAtaxiaProb : 0}%`, height: '100%', background: '#f59e0b', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

                {/* Healthy Control (NL) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', fontWeight: 700, color: '#34d399' }}>
                    <span>Healthy Physiological Baseline</span>
                    <span style={{ fontFamily: 'monospace' }}>{telemetry ? `${telemetry.differential.healthyBaselineProb}%` : '90%'}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: `${telemetry ? telemetry.differential.healthyBaselineProb : 90}%`, height: '100%', background: '#10b981', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

              </div>

              {/* Clinical Interpretation */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.4rem', fontSize: '0.66rem', color: '#94a3b8', lineHeight: 1.3 }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>Inference: </span>
                {telemetry?.differential.primaryPrediction || 'Calibrating motor baseline...'}
              </div>
            </div>

            {/* 3. BOTTOM-LEFT HUD: 60 FPS KINETIC OSCILLOSCOPE d(t) */}
            <div style={{ position: 'absolute', bottom: '0.75rem', left: '0.75rem', background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '0.65rem 0.85rem', width: '300px', pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Aperture Waveform d(t)
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  {telemetry ? `${telemetry.totalTaps} Taps • Cadence: ${telemetry.meanCadenceHz}Hz` : '0 Taps'}
                </span>
              </div>
              <canvas
                ref={oscilloscopeRef}
                width={280}
                height={55}
                style={{ width: '100%', height: '55px', borderRadius: '4px' }}
              />
            </div>

            {/* 4. BOTTOM-RIGHT HUD: FNT CEREBELLAR TELEMETRY OR REAL-TIME WELCH'S FFT TREMOR POWER SPECTRUM */}
            {activeProtocol === 'task-3-12' ? (
              <div style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '0.65rem 0.85rem', width: '310px', pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    FNT Cerebellar Telemetry
                  </span>
                  <span style={{ fontSize: '0.64rem', fontWeight: 800, color: telemetry?.fingerToNose.clinicalSeverity.includes('Normal') ? '#34d399' : '#fbbf24' }}>
                    {telemetry ? telemetry.fingerToNose.clinicalSeverity : 'Calibrating'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', fontSize: '0.67rem', fontFamily: 'JetBrains Mono, monospace' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Cycles Completed:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 800 }}>{telemetry?.fingerToNose.completedCycles || 0} / 5</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Path Curvature (κ):</span>
                    <span style={{ color: (telemetry?.fingerToNose.pathCurvatureIndex || 1) > 1.25 ? '#fbbf24' : '#10b981', fontWeight: 800 }}>
                      {telemetry ? telemetry.fingerToNose.pathCurvatureIndex.toFixed(2) : '1.02'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Dysmetria Metric:</span>
                    <span style={{ color: telemetry?.fingerToNose.dysmetriaType === 'Normometria' ? '#10b981' : '#f87171', fontWeight: 700 }}>
                      {telemetry ? telemetry.fingerToNose.dysmetriaType : 'Normometria'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Terminal Oscillation:</span>
                    <span style={{ color: (telemetry?.fingerToNose.terminalIntentionPowerMm2 || 0) > 4 ? '#f87171' : '#34d399' }}>
                      {telemetry ? telemetry.fingerToNose.terminalIntentionPowerMm2.toFixed(1) : '0.0'} mm
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '0.65rem 0.85rem', width: '300px', pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Tremor FFT Spectrum (0–16 Hz)
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: telemetry && telemetry.tremorClassification === 'Parkinsonian Resting Tremor' ? '#f87171' : '#34d399' }}>
                    {telemetry ? telemetry.tremorClassification : 'Baseline'}
                  </span>
                </div>

                <div style={{ height: '55px', display: 'flex', alignItems: 'flex-end', gap: '2px', background: 'rgba(0,0,0,0.25)', padding: '0.25rem 0.15rem', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  {telemetry && telemetry.spectrumBins.map((bin, i) => {
                    const isParkinsonBand = bin.frequency >= 4.0 && bin.frequency <= 6.5;
                    const isEssentialBand = bin.frequency >= 7.5 && bin.frequency <= 12.0;
                    const barHeight = Math.min(100, Math.max(6, (bin.power / 16) * 100));

                    let barColor = 'rgba(255, 255, 255, 0.3)';
                    if (bin.isPeak) barColor = '#ef4444';
                    else if (isParkinsonBand) barColor = 'rgba(248, 113, 113, 0.75)';
                    else if (isEssentialBand) barColor = 'rgba(192, 132, 252, 0.75)';

                    return (
                      <div
                        key={i}
                        style={{ flex: 1, height: `${barHeight}%`, background: barColor, borderRadius: '1px 1px 0 0', transition: 'height 0.06s ease' }}
                      />
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.6rem', color: '#64748b', fontFamily: 'monospace' }}>
                  <span>0 Hz</span>
                  <span style={{ color: '#f87171' }}>4-6 Hz (Parkinson)</span>
                  <span style={{ color: '#c084fc' }}>8-12 Hz (Essential)</span>
                  <span>16 Hz</span>
                </div>
              </div>
            )}

            {/* 5. BOTTOM-CENTER HUD: INSTANTANEOUS CLINICAL ALERT BANNER */}
            <div style={{ position: 'absolute', bottom: '0.75rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: telemetry?.clinicalAlert ? 'rgba(220, 38, 38, 0.95)' : telemetry?.fingerToNose.isNoseTouching ? 'rgba(16, 185, 129, 0.95)' : telemetry?.targetReaching.isTargetLocked ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.90)', backdropFilter: 'blur(8px)', border: `1px solid ${telemetry?.clinicalAlert ? '#fca5a5' : telemetry?.fingerToNose.isNoseTouching || telemetry?.targetReaching.isTargetLocked ? '#86efac' : 'rgba(255, 255, 255, 0.15)'}`, padding: '0.45rem 1.15rem', borderRadius: '30px', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, pointerEvents: 'none', zIndex: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff' }}></span>
              {telemetry?.clinicalAlert || (activeProtocol === 'task-3-12' ? (
                telemetry?.fingerToNose.currentPhase === 'REACH_NOSE'
                  ? `👉 STEP 1: TOUCH YOUR NOSE (d: ${telemetry.fingerToNose.distanceFingerToNoseMm} mm)`
                  : telemetry?.fingerToNose.currentPhase === 'REACH_TARGET'
                    ? `👉 STEP 2: EXTEND ARM TO EXAMINER TARGET (d: ${telemetry.fingerToNose.distanceFingerToTargetMm} mm)`
                    : `👉 STEP 3: RETURN FINGER BACK TO NOSE (d: ${telemetry.fingerToNose.distanceFingerToNoseMm} mm)`
              ) : telemetry?.isPinching ? 'FINGER PINCH CONTACT DETECTED' : 'BIOMECHANICAL MOTOR TELEMETRY ACTIVE')}
            </div>

            {/* Top-Center 10s Timed Clinical Trial Pill + Stop Vision Button */}
            <div style={{ position: 'absolute', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', zIndex: 30, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isTrialRunning ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.9rem', background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(8px)', border: '1.5px solid #38bdf8', borderRadius: '24px', boxShadow: '0 4px 20px rgba(2, 132, 199, 0.45)' }}>
                  <Timer size={14} color="#38bdf8" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.7rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                      <span style={{ color: trialRemainingSec > 5 ? '#38bdf8' : '#fbbf24' }}>
                        {trialRemainingSec > 5 ? 'EPOCH 1 (0–5s)' : 'EPOCH 2 (5–10s)'}
                      </span>
                      <span>•</span>
                      <span>{trialRemainingSec.toFixed(1)}s LEFT</span>
                    </div>
                    <div style={{ width: '160px', height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, ((10 - trialRemainingSec) / 10) * 100)}%`, height: '100%', background: trialRemainingSec > 5 ? '#38bdf8' : '#f59e0b', transition: 'width 0.1s linear' }} />
                    </div>
                  </div>
                  <button
                    onClick={handleCancelTimedTrial}
                    style={{ padding: '0.2rem 0.55rem', background: 'rgba(255,255,255,0.12)', color: '#cbd5e1', border: 'none', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartTimedTrial}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.95rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: '1px solid rgba(186, 230, 253, 0.4)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)' }}
                >
                  <Timer size={13} /> Start 10s Timed Exam
                </button>
              )}

              <button
                onClick={stopCamera}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.85rem', background: 'rgba(220, 38, 38, 0.85)', backdropFilter: 'blur(4px)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <VideoOff size={13} /> Stop Vision Stream
              </button>
            </div>
          </>
        )}

      </div>

      {/* Clinical Diagnostic PDF Report Modal */}
      {isReportOpen && (
        <KinematicsReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          telemetry={reportSnapshot || kinematicsEngineRef.current.getSessionReportTelemetry(false, activeProtocol)}
          subjectName="Live Clinical Evaluator"
          subjectType="Evaluator (Judge Baseline)"
          protocolName={activeProtocol === 'task-3-4' ? 'MDS-UPDRS Task 3.4 (Finger Tapping)' : activeProtocol === 'task-3-12' ? 'MDS-UPDRS Task 3.12 (Finger-to-Nose & Dysmetria)' : 'MDS-UPDRS Task 3.15 (Postural Tremor FFT)'}
        />
      )}

      {/* Interactive Academic Viva Defense Guide Modal */}
      <JudgeDefenseModal
        isOpen={isDefenseModalOpen}
        onClose={() => setIsDefenseModalOpen(false)}
      />

    </div>
  );
};
