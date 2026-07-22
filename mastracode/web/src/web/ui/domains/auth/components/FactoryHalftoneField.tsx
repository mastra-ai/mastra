import { useEffect, useRef } from 'react';

const BAYER_8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
] as const;

const CARDS = [
  [0, 0.14, 0.05, 0.82, 0.13, 0.82],
  [0, 0.36, 0.19, 0.68, 0.1, 0.64],
  [0, 0.62, 0.02, 0.88, 0.14, 0.9],
  [1, 0.2, 0.02, 0.9, 0.11, 0.92],
  [1, 0.46, 0.16, 0.76, 0.14, 0.78],
  [1, 0.73, 0.04, 0.86, 0.1, 0.7],
  [2, 0.12, 0.15, 0.76, 0.15, 0.7],
  [2, 0.38, 0.03, 0.89, 0.11, 0.86],
  [2, 0.66, 0.2, 0.7, 0.13, 0.64],
  [3, 0.23, 0.05, 0.83, 0.13, 0.68],
  [3, 0.51, 0.2, 0.68, 0.1, 0.58],
  [3, 0.75, 0.04, 0.84, 0.12, 0.76],
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function densityAt(lane: number, laneProgress: number, verticalProgress: number, time: number): number {
  let density = 0;

  for (const [cardLane, y, x, width, height, weight] of CARDS) {
    if (lane !== cardLane) continue;

    const edgeNoise = Math.sin((verticalProgress * 94 + y * 13) * Math.PI) * 0.018;
    const insideX =
      smoothstep(x - 0.035 + edgeNoise, x + 0.025 + edgeNoise, laneProgress) *
      (1 - smoothstep(x + width - 0.04, x + width + 0.025, laneProgress));
    const insideY =
      smoothstep(y - 0.015, y + 0.012, verticalProgress) *
      (1 - smoothstep(y + height - 0.012, y + height + 0.018, verticalProgress));
    const progress = clamp((laneProgress - x) / width, 0, 1);
    const trail = 1 - smoothstep(0.14, 1, progress);
    const pulse = 0.97 + Math.sin(time * 0.00045 + y * 24 + lane) * 0.03;
    density = Math.max(density, insideX * insideY * (0.11 + trail * weight) * pulse);
  }

  return density;
}

/** Decorative halftone board for the Factory sign-in welcome screen. */
export function FactoryHalftoneField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || typeof CanvasRenderingContext2D === 'undefined') return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const computedStyle = window.getComputedStyle(container);
    const stageColors = [
      computedStyle.getPropertyValue('--factory-blue').trim(),
      computedStyle.getPropertyValue('--factory-green').trim(),
      computedStyle.getPropertyValue('--factory-purple').trim(),
      computedStyle.getPropertyValue('--factory-orange').trim(),
    ];
    const baseDot = computedStyle.getPropertyValue('--factory-dot').trim();
    const laneLine = computedStyle.getPropertyValue('--factory-lane-line').trim();
    const railLine = computedStyle.getPropertyValue('--factory-rail-line').trim();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let animationFrame: number | undefined;
    let pointer = { x: 0.56, y: 0.34, active: false };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);

      const mobile = width < 500;
      const top = mobile ? 64 : 94;
      const bottom = mobile ? 24 : 70;
      const fieldHeight = Math.max(1, height - top - bottom);
      const step = mobile ? 7 : clamp(width / 82, 8, 11);
      const columns = Math.ceil(width / step);
      const rows = Math.ceil(fieldHeight / step);
      const dotSize = step * 0.58;
      const spotlightRadius = mobile ? 112 : 168;
      const pointerX = pointer.x * width;
      const pointerY = pointer.y * height;

      for (let row = 0; row < rows; row += 1) {
        const y = top + row * step;
        const verticalProgress = row / Math.max(rows - 1, 1);

        for (let column = 0; column < columns; column += 1) {
          const x = column * step;
          const horizontalProgress = column / Math.max(columns - 1, 1);
          const lane = Math.min(3, Math.floor(horizontalProgress * 4));
          const laneProgress = (horizontalProgress * 4) % 1;
          const laneInset = smoothstep(0.035, 0.095, laneProgress) * (1 - smoothstep(0.9, 0.97, laneProgress));
          const density = densityAt(lane, laneProgress, verticalProgress, time) * laneInset;
          const threshold = (BAYER_8[row % 8][column % 8] + 0.5) / 64;

          if (density <= threshold) continue;

          const distance = Math.hypot(x - pointerX, y - pointerY);
          const spotlight = pointer.active ? clamp(1 - distance / spotlightRadius, 0, 1) : 0;
          const size = density > 0.84 ? step * 0.78 : dotSize;
          const offset = (step - size) * 0.5;

          context.globalAlpha = 0.34 + density * 0.46 + spotlight * 0.2;
          context.fillStyle = spotlight > 0.24 ? stageColors[lane] : baseDot;
          context.fillRect(Math.round(x + offset), Math.round(y + offset), Math.ceil(size), Math.ceil(size));
        }
      }

      context.globalAlpha = 1;
      context.strokeStyle = laneLine;
      context.lineWidth = 1;
      for (let lane = 1; lane < 4; lane += 1) {
        const x = Math.round((width / 4) * lane) + 0.5;
        context.beginPath();
        context.moveTo(x, top - 18);
        context.lineTo(x, height - bottom + 10);
        context.stroke();
      }

      const travel = reducedMotion.matches ? 0.63 : (time * 0.000055) % 1;
      const railY = top + fieldHeight * 0.56;
      context.setLineDash([2, 7]);
      context.strokeStyle = railLine;
      context.beginPath();
      context.moveTo(0, railY);
      context.lineTo(width, railY);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = stageColors[Math.min(3, Math.floor(travel * 4))];
      context.fillRect(Math.round(travel * (width - 8)), Math.round(railY - 4), 8, 8);
    };

    const animate = (time: number) => {
      draw(time);
      if (!reducedMotion.matches) animationFrame = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.round(rect.width);
      height = Math.round(rect.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(performance.now());
    };

    const handlePointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer = {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        active: true,
      };
    };

    const handlePointerLeave = () => {
      pointer = { ...pointer, active: false };
    };

    const handleReducedMotionChange = () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      if (reducedMotion.matches) draw(performance.now());
      else animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    resizeObserver?.observe(container);
    if (!resizeObserver) window.addEventListener('resize', resize, { passive: true });
    container.addEventListener('pointermove', handlePointer, { passive: true });
    container.addEventListener('pointerdown', handlePointer, { passive: true });
    container.addEventListener('pointerleave', handlePointerLeave);
    reducedMotion.addEventListener('change', handleReducedMotionChange);

    resize();
    if (!reducedMotion.matches) animationFrame = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      container.removeEventListener('pointermove', handlePointer);
      container.removeEventListener('pointerdown', handlePointer);
      container.removeEventListener('pointerleave', handlePointerLeave);
      reducedMotion.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  return (
    <div ref={containerRef} className="factory-halftone-field relative min-h-96 min-w-0 overflow-hidden lg:min-h-150">
      <div
        className="pointer-events-none absolute top-6 right-0 left-0 z-2 grid grid-cols-4 lg:top-11"
        aria-hidden="true"
      >
        <span className="factory-stage-label">Intake</span>
        <span className="factory-stage-label">Build</span>
        <span className="factory-stage-label">Review</span>
        <span className="factory-stage-label">Ship</span>
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-crosshair" aria-hidden="true" />
      <span className="factory-visual-hint pointer-events-none absolute right-0 bottom-8 hidden items-center gap-2 text-ui-xs text-neutral2 lg:inline-flex">
        Move across the factory
      </span>
    </div>
  );
}
