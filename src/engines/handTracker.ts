/**
 * Real-Time 21-Joint 3D Hand Tracking Engine with Biomechanical Goniometry
 * & Dual-Anchor Finger-to-Nose Protocol (MDS-UPDRS Task 3.12 / SARA Ataxia)
 * 
 * Powered by Official Google MediaPipe Tasks Vision (HandLandmarker & FaceLandmarker)
 */

import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { HandLandmark, TargetReachingState, FingerToNoseState } from './kinematicsEngine';

export const BONE_CHAINS: Record<string, [number, number][]> = {
  thumb: [[0, 1], [1, 2], [2, 3], [3, 4]],
  index: [[0, 5], [5, 6], [6, 7], [7, 8]],
  middle: [[0, 9], [9, 10], [10, 11], [11, 12]],
  ring: [[0, 13], [13, 14], [14, 15], [15, 16]],
  pinky: [[0, 17], [17, 18], [18, 19], [19, 20]],
  palmBridges: [[5, 9], [9, 13], [13, 17]]
};

export class HighSpeedHandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private isVisionLoading = false;
  private isVisionReady = false;
  private lastTimestamp = -1;

  private latestLandmarks: HandLandmark[] | null = null;
  private latestNose: HandLandmark | null = null;
  private latestHandedness: 'Right' | 'Left' | 'Unknown' = 'Right';
  private latestConfidence = 0;

  // Kinetic Trajectory Ribbon History (last 16 frames of index tip)
  private indexTrail: { x: number; y: number; t: number }[] = [];

  constructor() {
    this.initVision();
  }

  public async initVision() {
    if (this.isVisionLoading || this.isVisionReady) return;
    this.isVisionLoading = true;

    try {
      console.log('⏳ Initializing Google MediaPipe Vision Tasks...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      console.log('⏳ Instantiating HandLandmarker GPU Pipeline...');
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.35
      });

      console.log('⏳ Instantiating FaceLandmarker GPU Pipeline...');
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35
      });

      this.isVisionReady = true;
      this.isVisionLoading = false;
      console.log('✓ Google MediaPipe Tasks-Vision (Hand + Face/Nose) fully armed & active at 60 FPS!');
    } catch (err) {
      console.error('Critical MediaPipe Vision initialization error:', err);
      this.isVisionLoading = false;
    }
  }

  public trackHand(video: HTMLVideoElement): {
    landmarks: HandLandmark[] | null;
    handedness: 'Right' | 'Left' | 'Unknown';
    confidence: number;
    engineType: string;
    noseLandmark: HandLandmark | null;
  } {
    if (!video || video.readyState < 2) {
      return { landmarks: null, handedness: 'Unknown', confidence: 0, engineType: 'Awaiting Video', noseLandmark: null };
    }

    if (!this.isVisionReady && !this.isVisionLoading) {
      this.initVision();
      return { landmarks: null, handedness: 'Unknown', confidence: 0, engineType: 'Starting Vision Engine...', noseLandmark: null };
    }

    if (!this.isVisionReady) {
      return { landmarks: null, handedness: 'Unknown', confidence: 0, engineType: 'Loading GPU Models...', noseLandmark: null };
    }

    const now = performance.now();
    const ts = now > this.lastTimestamp ? now : this.lastTimestamp + 1;
    this.lastTimestamp = ts;

    // 1. Detect Real 21-Joint 3D Hand Landmarks
    if (this.handLandmarker) {
      try {
        const handResult = this.handLandmarker.detectForVideo(video, ts);
        if (handResult.landmarks && handResult.landmarks.length > 0) {
          const raw = handResult.landmarks[0];
          this.latestLandmarks = raw.map(pt => ({
            x: pt.x,
            y: pt.y,
            z: pt.z || 0
          }));
          const handednessInfo = handResult.handednesses && handResult.handednesses[0] && handResult.handednesses[0][0];
          this.latestHandedness = (handednessInfo?.displayName as any) || 'Right';
          this.latestConfidence = handednessInfo?.score || 0.95;
        } else {
          this.latestLandmarks = null;
        }
      } catch (e) {
        // Drop corrupted frame safely
      }
    }

    // 2. Detect 3D Face / Nose Tip (Landmark 1 = Anatomical Nose Tip, Landmark 4 = Nose Bridge)
    if (this.faceLandmarker) {
      try {
        const faceResult = this.faceLandmarker.detectForVideo(video, ts);
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          const face = faceResult.faceLandmarks[0];
          const nosePt = face[1] || face[4];
          if (nosePt) {
            this.latestNose = {
              x: nosePt.x,
              y: nosePt.y,
              z: nosePt.z || 0
            };
          }
        } else {
          this.latestNose = null;
        }
      } catch (e) {
        // Drop corrupted frame safely
      }
    }

    return {
      landmarks: this.latestLandmarks,
      handedness: this.latestHandedness,
      confidence: this.latestConfidence,
      engineType: this.latestLandmarks ? 'Google MediaPipe GPU WASM' : 'Searching for Hand',
      noseLandmark: this.latestNose
    };
  }

  /**
   * Render Glowing 21-Joint 3D Biometric Skeleton
   * Coordinates mathematically mirrored: (1 - pt.x) * width
   * Text is 100% UN-MIRRORED, normal, and crisp!
   */
  public renderOverlay(
    ctx: CanvasRenderingContext2D,
    landmarks: HandLandmark[] | null,
    width: number,
    height: number,
    pinchApertureMm: number,
    velocityMmS: number,
    isPinching: boolean,
    indexFlexionDeg = 150,
    targetState?: TargetReachingState,
    isTargetMode = false,
    fingerToNose?: FingerToNoseState
  ) {
    ctx.clearRect(0, 0, width, height);

    const getX = (pt: HandLandmark) => (1 - pt.x) * width;
    const getY = (pt: HandLandmark) => pt.y * height;

    // 0. Render Task 3.12 / SARA Dual Reticle (Nose Target + Examiner Target)
    if (isTargetMode && fingerToNose && targetState) {
      const noseX = (1 - fingerToNose.noseCoords.x) * width;
      const noseY = fingerToNose.noseCoords.y * height;
      const tgX = targetState.targetX * width;
      const tgY = targetState.targetY * height;

      ctx.save();
      // Guided Flight Corridor between Nose and Target
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.lineTo(tgX, tgY);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // 0A. HOLOGRAPHIC NOSE RETICLE [N0]
      const isNoseTouching = fingerToNose.isNoseTouching;
      ctx.beginPath();
      ctx.arc(noseX, noseY, isNoseTouching ? 36 : 28, 0, 2 * Math.PI);
      ctx.strokeStyle = isNoseTouching ? 'rgba(16, 185, 129, 0.9)' : 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(noseX, noseY, 12, 0, 2 * Math.PI);
      ctx.fillStyle = isNoseTouching ? 'rgba(16, 185, 129, 0.45)' : 'rgba(2, 132, 199, 0.35)';
      ctx.fill();
      ctx.strokeStyle = isNoseTouching ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(noseX - 18, noseY); ctx.lineTo(noseX + 18, noseY);
      ctx.moveTo(noseX, noseY - 18); ctx.lineTo(noseX, noseY + 18);
      ctx.strokeStyle = isNoseTouching ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = isNoseTouching ? '#34d399' : '#38bdf8';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isNoseTouching ? '✅ NOSE TOUCHED' : `👃 NOSE [N0] (${fingerToNose.distanceFingerToNoseMm} mm)`,
        noseX,
        noseY - 32
      );

      // 0B. VIRTUAL EXAMINER TARGET RETICLE [T1]
      const isTargetLocked = targetState.isTargetLocked;
      ctx.beginPath();
      ctx.arc(tgX, tgY, isTargetLocked ? 38 : 30, 0, 2 * Math.PI);
      ctx.strokeStyle = isTargetLocked ? 'rgba(16, 185, 129, 0.9)' : 'rgba(251, 191, 36, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(tgX, tgY, 14, 0, 2 * Math.PI);
      ctx.fillStyle = isTargetLocked ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.35)';
      ctx.fill();
      ctx.strokeStyle = isTargetLocked ? '#10b981' : '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(tgX - 22, tgY); ctx.lineTo(tgX + 22, tgY);
      ctx.moveTo(tgX, tgY - 22); ctx.lineTo(tgX, tgY + 22);
      ctx.strokeStyle = isTargetLocked ? '#10b981' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = isTargetLocked ? '#34d399' : '#fbbf24';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isTargetLocked ? '🎯 TARGET LOCKED' : `🎯 TARGET [T1] (${targetState.distanceToTargetMm} mm)`,
        tgX,
        tgY - 34
      );

      ctx.restore();
    }

    if (!landmarks || landmarks.length < 21) {
      this.indexTrail = [];
      ctx.save();
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      const rx = width * 0.28;
      const ry = height * 0.15;
      const rw = width * 0.44;
      const rh = height * 0.7;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = '#0284c7';
      ctx.font = '700 13px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✋ PLACE HAND IN CAMERA FIELD TO BEGIN REAL-TIME SCAN', width / 2, ry + 36);
      ctx.restore();
      return;
    }

    ctx.save();

    // Track index fingertip for kinetic velocity ribbon
    const indexTip = landmarks[8];
    const curIx = getX(indexTip);
    const curIy = getY(indexTip);
    this.indexTrail.push({ x: curIx, y: curIy, t: performance.now() });
    if (this.indexTrail.length > 14) this.indexTrail.shift();

    // 1. Draw Kinetic Trajectory Ribbon (Innovation)
    if (this.indexTrail.length >= 3) {
      for (let i = 1; i < this.indexTrail.length; i++) {
        const p1 = this.indexTrail[i - 1];
        const p2 = this.indexTrail[i];
        const alpha = (i / this.indexTrail.length) * 0.6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = (i / this.indexTrail.length) * 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // Connect Index Tip to Active Goal (Nose or Target) based on FNT Phase
    if (isTargetMode && targetState) {
      const tgX = targetState.targetX * width;
      const tgY = targetState.targetY * height;
      const noseX = fingerToNose ? (1 - fingerToNose.noseCoords.x) * width : width / 2;
      const noseY = fingerToNose ? fingerToNose.noseCoords.y * height : height * 0.35;

      const isGoingToNose = fingerToNose && (fingerToNose.currentPhase === 'REACH_NOSE' || fingerToNose.currentPhase === 'RETURN_NOSE');
      const goalX = isGoingToNose ? noseX : tgX;
      const goalY = isGoingToNose ? noseY : tgY;
      const isLocked = isGoingToNose ? (fingerToNose && fingerToNose.isNoseTouching) : targetState.isTargetLocked;

      ctx.beginPath();
      ctx.moveTo(curIx, curIy);
      ctx.lineTo(goalX, goalY);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = isLocked
        ? 'rgba(16, 185, 129, 0.85)'
        : (isGoingToNose ? 'rgba(56, 189, 248, 0.75)' : 'rgba(245, 158, 11, 0.75)');
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Draw Biometric Bones by Anatomical Finger Group
    const drawChain = (chain: [number, number][], strokeColor: string, lineWidth = 3.5) => {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      chain.forEach(([a, b]) => {
        const p1 = landmarks[a];
        const p2 = landmarks[b];
        ctx.beginPath();
        ctx.moveTo(getX(p1), getY(p1));
        ctx.lineTo(getX(p2), getY(p2));
        ctx.stroke();
      });
    };

    drawChain(BONE_CHAINS.palmBridges, 'rgba(148, 163, 184, 0.7)', 2);
    drawChain(BONE_CHAINS.thumb, isPinching ? '#10b981' : '#059669', 3.5);
    drawChain(BONE_CHAINS.index, isPinching ? '#10b981' : '#0284c7', 3.5);
    drawChain(BONE_CHAINS.middle, '#0ea5e9', 2.5);
    drawChain(BONE_CHAINS.ring, '#6366f1', 2.5);
    drawChain(BONE_CHAINS.pinky, '#a855f7', 2.5);

    // 3. Draw 21 Articulation Nodes
    landmarks.forEach((pt, idx) => {
      const px = getX(pt);
      const py = getY(pt);

      const isThumbTip = idx === 4;
      const isIndexTip = idx === 8;
      const isOtherTip = idx === 12 || idx === 16 || idx === 20;

      ctx.beginPath();
      if (isThumbTip || isIndexTip) {
        ctx.arc(px, py, isPinching ? 9 : 7, 0, 2 * Math.PI);
        ctx.fillStyle = isPinching ? '#10b981' : '#0284c7';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        if (isPinching) {
          ctx.beginPath();
          ctx.arc(px, py, 16, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      } else if (isOtherTip) {
        ctx.arc(px, py, 5, 0, 2 * Math.PI);
        ctx.fillStyle = idx === 12 ? '#0ea5e9' : idx === 16 ? '#6366f1' : '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // 4. Dynamic Measurement Vector between Thumb (4) and Index (8)
    const thumb = landmarks[4];
    const index = landmarks[8];
    const tx = getX(thumb);
    const ty = getY(thumb);
    const ix = getX(index);
    const iy = getY(index);

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isPinching ? '#10b981' : 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Floating HUD Tag pinned to index fingertip (100% UN-MIRRORED TEXT!)
    const tagX = ix > width - 150 ? ix - 130 : ix + 20;
    const tagY = Math.max(20, Math.min(height - 60, iy - 15));
    const tagWidth = 125;
    const tagHeight = 48;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 8);
    ctx.fill();
    ctx.strokeStyle = isPinching ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px Inter, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${pinchApertureMm} mm`, tagX + 10, tagY + 20);

    ctx.fillStyle = isPinching ? '#34d399' : '#94a3b8';
    ctx.font = '700 10.5px Inter, monospace';
    ctx.fillText(isPinching ? '● CONTACT (0mm)' : `${velocityMmS} mm/s • ${indexFlexionDeg}°`, tagX + 10, tagY + 38);

    // 6. Joint Goniometer Arc Tag at Index MCP Knuckle (Joint 5)
    const mcp = landmarks[5];
    const mx = getX(mcp);
    const my = getY(mcp);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.85)';
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, (indexFlexionDeg / 180) * Math.PI);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
