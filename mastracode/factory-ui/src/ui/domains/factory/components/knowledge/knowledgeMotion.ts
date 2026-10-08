/** CSS minification may normalize milliseconds to seconds. */
export function readKnowledgeDuration(element: HTMLElement, token: string): number {
  const duration = getComputedStyle(element).getPropertyValue(token).trim();
  const value = parseFloat(duration);
  if (!Number.isFinite(value)) return 300;
  return value * (duration.endsWith('ms') ? 1 : 1000);
}

/** Match cubic-bezier(.22, 1, .36, 1): prompt travel, then a gentle landing. */
export function easeKnowledgeMotion(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  // Invert the Bezier's time axis; its value axis simplifies to 1 - (1 - t)^3.
  let time = progress;
  for (let iteration = 0; iteration < 6; iteration++) {
    const x = time * (0.66 + time * (-0.24 + time * 0.58));
    const slope = 0.66 + time * (-0.48 + time * 1.74);
    time = Math.max(0, Math.min(1, time - (x - progress) / slope));
  }
  return 1 - (1 - time) ** 3;
}
