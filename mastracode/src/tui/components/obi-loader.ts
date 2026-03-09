import chalk from 'chalk';
import { getThemeMode } from '../theme.js';

const GRADIENT_WIDTH = 30; // Width of the bright spot as percentage of total text
const BASE_COLOR = [124, 58, 237]; // #b588fe Mastra purple is too washed out, using #7c3aed
function getMinBrightness(): number {
  return getThemeMode() === 'dark' ? 0.45 : 0.55;
}

/**
 * Parse a hex color string to [r, g, b].
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Idle brightness target for fade-out interpolation */
const IDLE_BRIGHTNESS = 0.8;

/**
 * Applies a sweeping gradient animation to a plain text string.
 * A bright spot moves left-to-right across the text.
 *
 * @param text - Plain text to colorize (no ANSI codes)
 * @param offset - Current animation offset (0-1, wraps around)
 * @param color - Optional hex color override (defaults to purple accent)
 * @param fadeProgress - 0 = full animation, 1 = fully idle (flattens gradient)
 * @returns Chalk-colored string
 */
export function applyGradientSweep(text: string, offset: number, color?: string, fadeProgress = 0): string {
  const chars = [...text];
  const totalChars = chars.length;
  if (totalChars === 0) return text;

  const baseColor = color ? hexToRgb(color) : BASE_COLOR;
  const gradientCenter = (offset % 1) * 100;

  return chars
    .map((char, i) => {
      if (char === ' ') return ' ';

      const charPosition = (i / totalChars) * 100;
      let distance = Math.abs(charPosition - gradientCenter);

      // Wrap-around for smooth cycling
      if (distance > 50) {
        distance = 100 - distance;
      }

      const normalizedDistance = Math.min(distance / (GRADIENT_WIDTH / 2), 1);
      const minBrightness = getMinBrightness();
      const animBrightness = minBrightness + (1 - minBrightness) * (1 - normalizedDistance);

      // Interpolate toward idle brightness as fade progresses
      const brightness = animBrightness + (IDLE_BRIGHTNESS - animBrightness) * fadeProgress;

      const r = Math.floor(baseColor[0]! * brightness);
      const g = Math.floor(baseColor[1]! * brightness);
      const b = Math.floor(baseColor[2]! * brightness);

      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

/**
 * Manages the gradient sweep animation state.
 * Call `start()` when agent begins working, `stop()` when idle.
 * On each tick, call `getOffset()` to get the current sweep position.
 */
export class GradientAnimator {
  private offset = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onTick: () => void;
  private _isFadingOut = false;
  private _isFadingIn = false;
  private _fadeProgress = 0; // 0 = full animation, 1 = fully idle

  constructor(onTick: () => void) {
    this.onTick = onTick;
  }

  start(): void {
    if (this.intervalId && !this._isFadingOut) return;
    // Cancel any ongoing fade-out
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isFadingOut = false;
    this._isFadingIn = true;
    this._fadeProgress = 1; // Start from idle, fade toward full animation
    this.offset = 0;
    this.intervalId = setInterval(() => {
      this.offset += 0.03; // Speed: full sweep in ~55 ticks
      if (this._isFadingIn) {
        this._fadeProgress -= 0.06; // ~17 steps over ~500ms
        if (this._fadeProgress <= 0) {
          this._fadeProgress = 0;
          this._isFadingIn = false;
        }
      }
      this.onTick();
    }, 80);
  }

  /**
   * Smoothly fade the gradient to idle state over ~500ms.
   */
  fadeOut(): void {
    if (!this.intervalId) return;
    if (this._isFadingOut) return;
    this._isFadingOut = true;
    this._fadeProgress = 0;
    // Replace the animation interval with a fade interval
    clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this._fadeProgress += 0.08; // ~12 steps over ~500ms
      if (this._fadeProgress >= 1) {
        this._fadeProgress = 1;
        this.stop();
      }
      this.onTick();
    }, 40);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isFadingOut = false;
    this._fadeProgress = 0;
    this.offset = 0;
  }

  getOffset(): number {
    return this.offset;
  }

  /** 0 = full animation, 1 = fully idle. Use to interpolate colors. */
  getFadeProgress(): number {
    return this._fadeProgress;
  }

  isFadingOut(): boolean {
    return this._isFadingOut;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
