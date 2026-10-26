import { Camera, BoundingBox } from '../types';

export function drawSimulatedScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneType: string,
  hasFire: boolean,
  time: number
) {
  // Sleek Security Operations Center (SOC) Surveillance Grid
  ctx.save();

  // Dark surveillance backdrop
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0a0d14');
  grad.addColorStop(0.5, '#0d1117');
  grad.addColorStop(1, '#05070a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Digital surveillance grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Crosshair / reticle in center
  const cx = w * 0.5;
  const cy = h * 0.5;
  ctx.strokeStyle = hasFire ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1.5;

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.stroke();

  // Reticle notches
  ctx.beginPath();
  ctx.moveTo(cx - 50, cy);
  ctx.lineTo(cx - 40, cy);
  ctx.moveTo(cx + 40, cy);
  ctx.lineTo(cx + 50, cy);
  ctx.moveTo(cx, cy - 50);
  ctx.lineTo(cx, cy - 40);
  ctx.moveTo(cx, cy + 40);
  ctx.lineTo(cx, cy + 50);
  ctx.stroke();

  // Center status badge
  ctx.fillStyle = hasFire ? 'rgba(239, 68, 68, 0.9)' : 'rgba(56, 189, 248, 0.7)';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    hasFire ? 'HAZARD TARGET ACQUIRED' : 'SURVEILLANCE SENSOR ACTIVE',
    cx,
    cy + 60
  );

  // Draw realistic animated flame and rising smoke if fire alarm is triggered
  if (hasFire) {
    drawFlames(ctx, cx, cy, w * 0.24, h * 0.34, time);
  }

  ctx.restore();
}

export function drawFlames(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  time: number
) {
  ctx.save();

  // 1. Ambient Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 1.5);
  glowGrad.addColorStop(0, 'rgba(255, 100, 0, 0.55)');
  glowGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.25)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 2. Smoke Particles rising
  for (let i = 0; i < 6; i++) {
    const smokeOffset = (time * 0.05 + i * 40) % (h * 1.3);
    const smokeX = cx + Math.sin(time * 0.003 + i) * 20;
    const smokeY = cy - smokeOffset;
    const alpha = Math.max(0, 0.4 - (smokeOffset / (h * 1.3)) * 0.4);
    ctx.fillStyle = `rgba(70, 70, 70, ${alpha})`;
    ctx.beginPath();
    ctx.arc(smokeX, smokeY, 14 + i * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Flame Tongues
  const tongues = 5;
  for (let i = 0; i < tongues; i++) {
    const tX = cx - w * 0.4 + (i * w * 0.8) / (tongues - 1);
    const flicker = Math.sin(time * 0.015 + i * 2) * 15;
    const topY = cy - h * 0.8 + flicker;

    const flameGrad = ctx.createLinearGradient(tX, cy, tX, topY);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.2, '#fef08a');
    flameGrad.addColorStop(0.5, '#f97316');
    flameGrad.addColorStop(0.9, '#dc2626');
    flameGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');

    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(tX - 16, cy + 10);
    ctx.quadraticCurveTo(tX - 22, cy - h * 0.4, tX + flicker * 0.5, topY);
    ctx.quadraticCurveTo(tX + 22, cy - h * 0.4, tX + 16, cy + 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawCctvOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: Camera,
  isMonitoring: boolean,
  fps: number,
  isCompact: boolean = false
) {
  ctx.save();
  const fontSize = isCompact ? 11 : 13;
  ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.textAlign = 'left';

  // Top Left: Camera Name + Room
  const topPad = isCompact ? 18 : 26;
  const linePad = isCompact ? 14 : 18;
  ctx.fillText(`CAM: ${camera.name.toUpperCase()}`, 12, topPad);
  ctx.fillText(`LOC: ${camera.room.toUpperCase()}`, 12, topPad + linePad);

  // Top Right: Live Date & Time + REC Status
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false });
  const recText = isMonitoring ? '● REC' : '○ STBY';

  ctx.fillStyle = isMonitoring ? '#ef4444' : '#9ca3af';
  ctx.fillText(recText, w - (isCompact ? 60 : 75), topPad);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(timeStr, w - (isCompact ? 75 : 90), topPad + linePad);

  // Bottom Left: Hardware & FPS
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`YOLOv8 | ${fps} FPS`, 12, h - (isCompact ? 8 : 14));

  ctx.restore();
}
