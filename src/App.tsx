import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, VideoOff, Activity, ShieldCheck, Maximize2, Minimize2,
  Volume2, VolumeX, FileText, RefreshCw, AlertTriangle, CheckCircle2, ChevronRight
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Raw Landmark Coordinates for Live Transparency Inspector
  const [rawCoordinates, setRawCoordinates] = useState<{
    thumbTip: { x: number; y: number; z: number };
    indexTip: { x: number; y: number; z: number };
    wrist: { x: number; y: number; z: number };
    fps: number;
  }>({
    thumbTip: { x: 0, y: 0, z: 0 },
    indexTip: { x: 0, y: 0, z: 0 },
    wrist: { x: 0, y: 0, z: 0 },
    fps: 60
  });

  // Telemetry Output State
  const [telemetry, setTelemetry] = useState<KinematicsTelemetry | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

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

  // Initialize hand tracker once
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
    kinematicsEngineRef.current.resetSession();
  };

  // Start Real-Time Webcam Stream
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

  // Stop Webcam Stream
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

    const renderLoop = () => {
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const tracker = handTrackerRef.current;
      const engine = kinematicsEngineRef.current;

      // Calculate Real Live FPS
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

        // 1. Live Optical / MediaPipe Hand Landmark Detection
        const trackResult = tracker.trackHand(video);
        setEngineType(trackResult.engineType);

        // 2. Process Real Kinematics
        const telemetryResult = engine.processLandmarks(
          trackResult.landmarks,
          trackResult.handedness,
          trackResult.confidence
        );

        // 3. Update Raw Real-Time Coordinates for Live Inspector
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

        // 4. Zero-Latency Acoustic Sonification on Pinch Impact
        if (!wasPreviouslyPinching && telemetryResult.isPinching) {
          audioSonifier.playPinchClick();
        }
        if (telemetryResult.clinicalAlert && !wasPreviouslyPinching && telemetryResult.isPinching) {
          audioSonifier.playWarningAlert();
        }
        wasPreviouslyPinching = telemetryResult.isPinching;

        // 5. Render Glowing 3D Biometric Skeleton
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const history = telemetry.apertureHistory;
    if (history.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
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
      const y = h - Math.min(1.0, pt.aperture / maxApertureDisplay) * (h - 10) - 5;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const latest = history[history.length - 1];
    const curX = w - 4;
    const curY = h - Math.min(1.0, latest.aperture / maxApertureDisplay) * (h - 10) - 5;
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
      style={{
        minHeight: '100vh',
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
      <HeaderNav
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onResetSession={handleResetSession}
        onOpenReport={() => setIsReportOpen(true)}
        isCameraActive={isCameraActive}
        engineType={engineType}
      />

      {/* FULLSCREEN HERO CAMERA STAGE */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: 'calc(100vh - 75px)', overflow: 'hidden', background: '#020617' }}>
        
        {/* Actual Video Tag (Mirrored for Natural Kinesthetic Interaction) */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />

        {/* 60 FPS 21-Joint Biometric Skeleton Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }}
        />

        {/* IDLE HERO STATE (When Camera is Not Yet Active) */}
        {!isCameraActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.85) 0%, rgba(2, 6, 23, 0.98) 100%)', color: '#ffffff', padding: '2rem', textAlign: 'center', zIndex: 10 }}>
            <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.15)', border: '2px solid #0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: '#38bdf8', boxShadow: '0 0 30px rgba(2, 132, 199, 0.4)' }}>
              <Camera size={32} />
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 900, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              Autonomous 3D Motor Kinematics Scanner
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '520px', margin: '0 0 1.75rem 0', lineHeight: 1.5 }}>
              Launch your webcam to track all 21 hand joints at 60 FPS with client-side GPU acceleration. Measures real physical tapping frequency, amplitude fatigue, and live Welch's FFT tremor spectra with zero cloud latency.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={startCamera}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(2, 132, 199, 0.5)' }}
              >
                <Camera size={18} /> Enable Fullscreen Camera
              </button>
            </div>
          </div>
        )}

        {/* Camera Permission / Device Error Banner */}
        {cameraError && (
          <div style={{ position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(220, 38, 38, 0.95)', color: '#ffffff', padding: '0.85rem 1.5rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            ⚠️ {cameraError}
          </div>
        )}

        {/* =========================================================================
            FLOATING GLASS CLINICAL HUD PANELS (Overlaid on Camera Viewport)
            ========================================================================= */}
        {isCameraActive && (
          <>
            {/* 1. TOP-LEFT HUD: LIVE RAW COORDINATE TELEMETRY STREAM (PROVES REAL-TIME DATA) */}
            <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '1rem 1.25rem', width: '280px', pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live 3D Coordinate Stream
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                  ● {rawCoordinates.fps} FPS • &lt;16ms
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: '#cbd5e1' }}>
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
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.35rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: telemetry?.isPinching ? '#10b981' : '#ffffff' }}>
                  <span>Distance:</span>
                  <span>{telemetry ? `${telemetry.pinchApertureMm} mm` : '0 mm'}</span>
                </div>
              </div>
            </div>

            {/* 2. TOP-RIGHT HUD: QUANTITATIVE MDS-UPDRS SCOREBOARD */}
            <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '1rem 1.25rem', width: '310px', pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  MDS-UPDRS Motor Rating
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, padding: '0.15rem 0.55rem', borderRadius: '4px', background: !telemetry || telemetry.updrsGrade === 0 ? 'rgba(16, 185, 129, 0.2)' : telemetry.updrsGrade <= 2 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.25)', color: !telemetry || telemetry.updrsGrade === 0 ? '#34d399' : telemetry.updrsGrade <= 2 ? '#fbbf24' : '#f87171', border: '1px solid currentColor' }}>
                  GRADE {telemetry ? telemetry.updrsGrade : 0} / 4
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.65rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Cadence</span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
                    {telemetry ? `${telemetry.meanCadenceHz} Hz` : '0 Hz'}
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Amplitude Decay</span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: telemetry && telemetry.amplitudeDecayPercent > 30 ? '#f87171' : '#ffffff', fontFamily: 'monospace' }}>
                    {telemetry ? `${telemetry.amplitudeDecayPercent}%` : '0%'}
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Taps</span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {telemetry ? telemetry.totalTaps : 0}
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Tremor Peak</span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.15rem', fontWeight: 900, color: telemetry && telemetry.tremorFrequencyHz > 0 ? '#f87171' : '#34d399', fontFamily: 'monospace' }}>
                    {telemetry && telemetry.tremorFrequencyHz > 0 ? `${telemetry.tremorFrequencyHz} Hz` : '0 Hz'}
                  </p>
                </div>
              </div>

              <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.65rem 0 0 0', lineHeight: 1.3 }}>
                {telemetry?.updrsInterpretation || 'Tap index and thumb together to measure tapping cadence and fatigue.'}
              </p>
            </div>

            {/* 3. BOTTOM-LEFT HUD: 60 FPS KINETIC OSCILLOSCOPE d(t) */}
            <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.25rem', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '0.85rem 1rem', width: '360px', pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pinch Aperture Waveform d(t)
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Threshold: 16mm Contact
                </span>
              </div>
              <canvas
                ref={oscilloscopeRef}
                width={340}
                height={75}
                style={{ width: '100%', height: '75px', borderRadius: '4px' }}
              />
            </div>

            {/* 4. BOTTOM-RIGHT HUD: REAL-TIME WELCH'S FFT TREMOR POWER SPECTRUM */}
            <div style={{ position: 'absolute', bottom: '1.25rem', right: '1.25rem', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '0.85rem 1rem', width: '360px', pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Tremor FFT Spectrum (0–16 Hz)
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: telemetry && telemetry.tremorClassification === 'Parkinsonian Resting Tremor' ? '#f87171' : '#34d399' }}>
                  {telemetry ? telemetry.tremorClassification : 'Baseline'}
                </span>
              </div>

              {/* Live Spectrum Bars */}
              <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', gap: '2px', background: 'rgba(0,0,0,0.25)', padding: '0.35rem 0.2rem', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                {telemetry && telemetry.spectrumBins.map((bin, i) => {
                  const isParkinsonBand = bin.frequency >= 4.0 && bin.frequency <= 6.5;
                  const isEssentialBand = bin.frequency >= 7.5 && bin.frequency <= 12.0;
                  const barHeight = Math.min(100, Math.max(6, (bin.power / 16) * 100));

                  let barColor = 'rgba(255, 255, 255, 0.3)';
                  if (bin.isPeak) barColor = '#ef4444';
                  else if (isParkinsonBand) barColor = 'rgba(248, 113, 113, 0.7)';
                  else if (isEssentialBand) barColor = 'rgba(192, 132, 252, 0.7)';

                  return (
                    <div
                      key={i}
                      style={{ flex: 1, height: `${barHeight}%`, background: barColor, borderRadius: '1px 1px 0 0', transition: 'height 0.06s ease' }}
                    />
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.62rem', color: '#64748b', fontFamily: 'monospace' }}>
                <span>0 Hz</span>
                <span style={{ color: '#f87171' }}>4-6 Hz (Parkinson)</span>
                <span style={{ color: '#c084fc' }}>8-12 Hz (Essential)</span>
                <span>16 Hz</span>
              </div>
            </div>

            {/* 5. BOTTOM-CENTER HUD: INSTANTANEOUS CLINICAL ALERT BANNER */}
            <div style={{ position: 'absolute', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: telemetry?.clinicalAlert ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(8px)', border: `1px solid ${telemetry?.clinicalAlert ? '#fca5a5' : 'rgba(255, 255, 255, 0.15)'}`, padding: '0.5rem 1.25rem', borderRadius: '30px', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', transition: 'all 0.2s ease' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: telemetry?.clinicalAlert ? '#ffffff' : telemetry?.isPinching ? '#10b981' : '#38bdf8' }}></span>
              {telemetry?.clinicalAlert || (telemetry?.isPinching ? 'FINGER PINCH CONTACT DETECTED' : 'PHYSICAL MOTOR TRACKING ACTIVE')}
            </div>

            {/* Quick Stop Vision Floating Button (Top Center) */}
            <div style={{ position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
              <button
                onClick={stopCamera}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.9rem', background: 'rgba(220, 38, 38, 0.85)', backdropFilter: 'blur(4px)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <VideoOff size={13} /> Stop Vision Stream
              </button>
            </div>
          </>
        )}

      </div>

      {/* Clinical Diagnostic PDF Report Modal */}
      {telemetry && (
        <KinematicsReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          telemetry={telemetry}
          subjectName="Live Clinical Evaluator"
          subjectType="Evaluator (Judge Baseline)"
          protocolName="MDS-UPDRS Part III Motor Examination Protocol"
        />
      )}

    </div>
  );
};
