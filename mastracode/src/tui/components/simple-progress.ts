/**
 * Simple progress indicator component for single operations.
 * Shows a compact progress display with spinner and status text.
 */

import { Container, Text } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';

export interface SimpleProgressOptions {
  prefix?: string;
  showElapsed?: boolean;
  showPercentage?: boolean;
}

/**
 * Lightweight progress indicator for simple operations.
 * Features:
 * - Animated spinner
 * - Custom status text
 * - Optional elapsed time
 * - Optional percentage display
 */
export class SimpleProgressComponent extends Container {
  private status: string = '';
  private progress?: number;
  private startTime: number;
  private spinnerFrame = 0;
  private lastRenderTime = 0;
  private isActive = false;
  private options: Required<SimpleProgressOptions>;

  constructor(options: SimpleProgressOptions = {}) {
    super();
    this.options = {
      prefix: '',
      showElapsed: true,
      showPercentage: true,
      ...options,
    };
    this.startTime = Date.now();
  }

  /**
   * Start showing progress with initial status.
   */
  start(status: string): void {
    this.status = status;
    this.isActive = true;
    this.startTime = Date.now();
    this.rebuild();
  }

  /**
   * Update the status text.
   */
  updateStatus(status: string): void {
    this.status = status;
    this.rebuild();
  }

  /**
   * Update the progress percentage (0-100).
   */
  updateProgress(progress: number): void {
    this.progress = Math.min(100, Math.max(0, progress));
    this.rebuild();
  }

  /**
   * Mark the operation as complete.
   */
  complete(message?: string): void {
    this.isActive = false;
    this.status = message || 'Complete';
    this.progress = 100;
    this.rebuild();
  }

  /**
   * Mark the operation as failed.
   */
  fail(error: string): void {
    this.isActive = false;
    this.status = error;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();

    if (!this.status) return;

    const now = Date.now();

    // Update spinner animation
    if (this.isActive && now - this.lastRenderTime > 100) {
      this.spinnerFrame = (this.spinnerFrame + 1) % 10;
      this.lastRenderTime = now;
    }

    let text = '';

    // Add prefix if provided
    if (this.options.prefix) {
      text += this.options.prefix + ' ';
    }

    // Add spinner or status icon
    if (this.isActive) {
      const spinner = this.getSpinner();
      text += theme.fg('accent', spinner) + ' ';
    } else if (this.progress === 100) {
      text += theme.fg('success', '✓') + ' ';
    } else {
      text += theme.fg('error', '✗') + ' ';
    }

    // Add status text
    text += this.status;

    // Add progress percentage if enabled and available
    if (this.options.showPercentage && this.progress !== undefined) {
      text += theme.fg('dim', ` (${this.progress}%)`);
    }

    // Add elapsed time if enabled
    if (this.options.showElapsed && this.isActive) {
      const elapsed = Math.floor((now - this.startTime) / 1000);
      text += theme.fg('dim', ` ${elapsed}s`);
    }

    this.addChild(new Text(text, 0, 0));
  }
  private getSpinner(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    return frames[this.spinnerFrame]!;
  }

  render(maxWidth: number): string[] {
    this.rebuild();
    return super.render(maxWidth);
  }
}

/**
 * Create a temporary progress indicator that auto-hides when complete.
 * Useful for quick operations that need feedback.
 */
export class TemporaryProgressComponent extends SimpleProgressComponent {
  private hideTimeout?: NodeJS.Timeout;
  private hideDelay: number;

  constructor(options: SimpleProgressOptions & { hideDelay?: number } = {}) {
    super(options);
    this.hideDelay = options.hideDelay || 2000;
  }

  complete(message?: string): void {
    super.complete(message);
    this.hideTimeout = setTimeout(() => {
      this.clear();
    }, this.hideDelay);
  }

  fail(error: string): void {
    super.fail(error);
    this.hideTimeout = setTimeout(() => {
      this.clear();
    }, this.hideDelay * 2); // Show errors longer
  }

  override clear(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }
    super.clear();
  }
}
