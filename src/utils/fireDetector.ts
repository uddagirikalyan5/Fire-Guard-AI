import { BoundingBox } from '../types';

export interface DetectionResult {
  hasFire: boolean;
  hasSmoke: boolean;
  hazardType: 'Fire' | 'Smoke' | 'Fire & Smoke' | 'None';
  confidence: number;
  boxes: BoundingBox[];
  processingTimeMs: number;
}

/**
 * Real-Time Vision AI Detector for both Fire and Smoke in camera frames.
 * When either Smoke or Fire is detected, flags the hazard so the Water Extinguisher Pump
 * is automatically triggered ON.
 */
export function detectFireInCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  confidenceThreshold: number = 70,
  forceFire: boolean = false,
  forceSmoke: boolean = false
): DetectionResult {
  const startTime = performance.now();

  // 1. Simulation Override Handlers
  if (forceFire || forceSmoke) {
    const boxes: BoundingBox[] = [];
    const isBoth = forceFire && forceSmoke;
    const hasFire = forceFire;
    const hasSmoke = forceSmoke;
    const conf = Math.floor(88 + Math.random() * 9);

    if (forceFire) {
      const boxW = Math.floor(width * 0.34);
      const boxH = Math.floor(height * 0.42);
      const boxX = Math.floor(width * 0.28 + (Math.random() * 12 - 6));
      const boxY = Math.floor(height * 0.32 + (Math.random() * 12 - 6));
      boxes.push({
        x: Math.max(10, boxX),
        y: Math.max(10, boxY),
        width: boxW,
        height: boxH,
        confidence: conf,
        label: 'FIRE: PUMP TRIGGERED',
        color: '#ef4444'
      });
    }

    if (forceSmoke) {
      const sW = Math.floor(width * 0.45);
      const sH = Math.floor(height * 0.35);
      const sX = Math.floor(width * 0.20 + (Math.random() * 10 - 5));
      const sY = Math.floor(height * 0.10 + (Math.random() * 10 - 5));
      boxes.push({
        x: Math.max(10, sX),
        y: Math.max(10, sY),
        width: sW,
        height: sH,
        confidence: Math.floor(86 + Math.random() * 8),
        label: 'SMOKE: PUMP TRIGGERED',
        color: '#f59e0b'
      });
    }

    // Zone safety marker (Human)
    boxes.push({
      x: Math.max(10, Math.floor(width * 0.72)),
      y: Math.max(10, Math.floor(height * 0.25)),
      width: Math.floor(width * 0.22),
      height: Math.floor(height * 0.65),
      confidence: 94,
      label: 'HUMAN (HAZARD ZONE)',
      color: '#38bdf8'
    });

    return {
      hasFire,
      hasSmoke,
      hazardType: isBoth ? 'Fire & Smoke' : hasFire ? 'Fire' : 'Smoke',
      confidence: conf,
      boxes,
      processingTimeMs: Math.round(performance.now() - startTime + 6)
    };
  }

  // 2. Real Live Camera Vision Analysis (Color & Texture Heuristics)
  const sampleW = 80;
  const sampleH = 60;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  if (!tempCtx) {
    return { hasFire: false, hasSmoke: false, hazardType: 'None', confidence: 0, boxes: [], processingTimeMs: 1 };
  }

  tempCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);
  let imgData: ImageData;
  try {
    imgData = tempCtx.getImageData(0, 0, sampleW, sampleH);
  } catch {
    return { hasFire: false, hasSmoke: false, hazardType: 'None', confidence: 0, boxes: [], processingTimeMs: 1 };
  }

  const data = imgData.data;
  let firePixels = 0;
  let smokePixels = 0;

  // Bounding box bounds for fire
  let fireMinX = sampleW, fireMinY = sampleH, fireMaxX = 0, fireMaxY = 0;
  // Bounding box bounds for smoke
  let smokeMinX = sampleW, smokeMinY = sampleH, smokeMaxX = 0, smokeMaxY = 0;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // A. Flame / Fire Rule:
      // High Red channel, Red > Green, Green > Blue, Bright intensity
      if (r > 185 && g > 70 && b < 110 && r > g && g > b) {
        firePixels++;
        if (x < fireMinX) fireMinX = x;
        if (x > fireMaxX) fireMaxX = x;
        if (y < fireMinY) fireMinY = y;
        if (y > fireMaxY) fireMaxY = y;
      }

      // B. Smoke Rule:
      // Diffuse low-chroma gray/white particles (R, G, B values closely clustered)
      // Moderate-to-high luminance, typically rising in upper or middle frame
      const avg = (r + g + b) / 3;
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      if (maxDiff < 20 && avg >= 100 && avg <= 225 && y < sampleH * 0.75) {
        smokePixels++;
        if (x < smokeMinX) smokeMinX = x;
        if (x > smokeMaxX) smokeMaxX = x;
        if (y < smokeMinY) smokeMinY = y;
        if (y > smokeMaxY) smokeMaxY = y;
      }
    }
  }

  const totalPixels = sampleW * sampleH;
  const fireRatio = firePixels / totalPixels;
  const smokeRatio = smokePixels / totalPixels;

  const isFireDetected = fireRatio > 0.008;
  const isSmokeDetected = smokeRatio > 0.018;

  const fireConf = isFireDetected ? Math.min(99, Math.floor(72 + fireRatio * 600)) : 0;
  const smokeConf = isSmokeDetected ? Math.min(98, Math.floor(68 + smokeRatio * 450)) : 0;

  const boxes: BoundingBox[] = [];
  const scaleX = width / sampleW;
  const scaleY = height / sampleH;

  // Add Fire Bounding Box
  if (isFireDetected && fireConf >= confidenceThreshold && fireMaxX > fireMinX && fireMaxY > fireMinY) {
    boxes.push({
      x: Math.max(0, (fireMinX - 2) * scaleX),
      y: Math.max(0, (fireMinY - 2) * scaleY),
      width: Math.min(width, (fireMaxX - fireMinX + 6) * scaleX),
      height: Math.min(height, (fireMaxY - fireMinY + 6) * scaleY),
      confidence: fireConf,
      label: 'FIRE: PUMP TRIGGERED',
      color: '#ef4444'
    });
  }

  // Add Smoke Bounding Box
  if (isSmokeDetected && smokeConf >= confidenceThreshold && smokeMaxX > smokeMinX && smokeMaxY > smokeMinY) {
    boxes.push({
      x: Math.max(0, (smokeMinX - 3) * scaleX),
      y: Math.max(0, (smokeMinY - 3) * scaleY),
      width: Math.min(width, (smokeMaxX - smokeMinX + 8) * scaleX),
      height: Math.min(height, (smokeMaxY - smokeMinY + 8) * scaleY),
      confidence: smokeConf,
      label: 'SMOKE: PUMP TRIGGERED',
      color: '#f59e0b'
    });
  }

  const hasFire = isFireDetected && fireConf >= confidenceThreshold;
  const hasSmoke = isSmokeDetected && smokeConf >= confidenceThreshold;
  const maxConf = Math.max(fireConf, smokeConf);

  let hazardType: 'Fire' | 'Smoke' | 'Fire & Smoke' | 'None' = 'None';
  if (hasFire && hasSmoke) hazardType = 'Fire & Smoke';
  else if (hasFire) hazardType = 'Fire';
  else if (hasSmoke) hazardType = 'Smoke';

  return {
    hasFire,
    hasSmoke,
    hazardType,
    confidence: maxConf,
    boxes,
    processingTimeMs: Math.round(performance.now() - startTime + 5)
  };
}
