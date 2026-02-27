/**
 * Observational Memory progress indicator component.
 * Shows when OM is observing or reflecting on conversation history.
 */
import { Container, Text } from '@mariozechner/pi-tui';
import { defaultOMProgressState } from '@mastra/core/harness';
import type { OMBufferedStatus, OMProgressState, OMStatus } from '@mastra/core/harness';
import chalk from 'chalk';
import { theme, mastra } from '../theme.js';

// Re-export types from core for backward compatibility
export type { OMBufferedStatus, OMProgressState, OMStatus };
export { defaultOMProgressState };

/**
 * Component that displays OM progress in the status line area.
 * Shows a compact indicator when observation/reflection is happening.
 */
export class OMProgressComponent extends Container {
  private state: OMProgressState = defaultOMProgressState();
  private statusText: Text;

  constructor() {
    super();
    this.statusText = new Text('');
    this.children.push(this.statusText);
  }

  updateProgress(progress: {
    pendingTokens: number;
    threshold: number;
    thresholdPercent: number;
    observationTokens: number;
    reflectionThreshold: number;
    reflectionThresholdPercent: number;
  }): void {
    this.state.pendingTokens = progress.pendingTokens;
    this.state.threshold = progress.threshold;
    this.state.thresholdPercent = progress.thresholdPercent;
    this.state.observationTokens = progress.observationTokens;
    this.state.reflectionThreshold = progress.reflectionThreshold;
    this.state.reflectionThresholdPercent = progress.reflectionThresholdPercent;
    this.updateDisplay();
  }

  startObservation(cycleId: string, _tokensToObserve: number): void {
    this.state.status = 'observing';
    this.state.cycleId = cycleId;
    this.state.startTime = Date.now();
    this.updateDisplay();
  }

  endObservation(): void {
    this.state.status = 'idle';
    this.state.cycleId = undefined;
    this.state.startTime = undefined;
    this.updateDisplay();
  }

  startReflection(cycleId: string): void {
    this.state.status = 'reflecting';
    this.state.cycleId = cycleId;
    this.state.startTime = Date.now();
    this.updateDisplay();
  }

  endReflection(): void {
    this.state.status = 'idle';
    this.state.cycleId = undefined;
    this.state.startTime = undefined;
    this.updateDisplay();
  }

  failOperation(): void {
    this.state.status = 'idle';
    this.state.cycleId = undefined;
    this.state.startTime = undefined;
    this.updateDisplay();
  }

  getStatus(): OMStatus {
    return this.state.status;
  }

  private updateDisplay(): void {
    if (this.state.status === 'idle') {
      // Show threshold progress when idle (if any pending tokens)
      if (this.state.thresholdPercent > 0) {
        const percent = Math.round(this.state.thresholdPercent);
        const bar = this.renderProgressBar(percent, 10);
        this.statusText.setText(theme.fg('muted', `OM ${bar} ${percent}%`));
      } else {
        this.statusText.setText('');
      }
    } else if (this.state.status === 'observing') {
      const elapsed = this.state.startTime ? Math.round((Date.now() - this.state.startTime) / 1000) : 0;
      const spinner = this.getSpinner();
      this.statusText.setText(chalk.hex(mastra.orange)(`${spinner} Observing... ${elapsed}s`));
    } else if (this.state.status === 'reflecting') {
      const elapsed = this.state.startTime ? Math.round((Date.now() - this.state.startTime) / 1000) : 0;
      const spinner = this.getSpinner();
      this.statusText.setText(chalk.hex(mastra.pink)(`${spinner} Reflecting... ${elapsed}s`));
    }
  }

  private renderProgressBar(percent: number, width: number): string {
    const filled = Math.min(width, Math.round((percent / 100) * width));
    const empty = width - filled;
    const bar = '━'.repeat(filled) + '─'.repeat(empty);

    // Color based on threshold proximity — Mastra brand colors
    if (percent >= 90) {
      return chalk.hex(mastra.red)(bar); // Mastra red
    } else if (percent >= 70) {
      return chalk.hex(mastra.orange)(bar); // Mastra orange
    } else {
      return chalk.hex(mastra.darkGray)(bar); // Mastra dark gray
    }
  }
  private spinnerFrame = 0;
  private getSpinner(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerFrame = (this.spinnerFrame + 1) % frames.length;
    return frames[this.spinnerFrame]!;
  }

  render(maxWidth: number): string[] {
    this.updateDisplay();
    return this.statusText.render(maxWidth);
  }
}

/** Format token count without k suffix (e.g., 7234 -> "7.2", 200 -> "0.2", 0 -> "0") */
function formatTokensValue(n: number): string {
  if (n === 0) return '0';
  const k = n / 1000;
  const s = k.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Format token threshold with k suffix (e.g., 30000 -> "30k", 40000 -> "40k") */
function formatTokensThreshold(n: number): string {
  const k = n / 1000;
  const s = k.toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + 'k';
}

function colorByPercent(text: string, percent: number): string {
  if (percent >= 90) return chalk.hex(mastra.red)(text); // Mastra red
  if (percent >= 70) return chalk.hex(mastra.orange)(text); // Mastra orange
  return chalk.hex(mastra.darkGray)(text); // Mastra dark gray
}
/**
 * Format OM observation threshold for status bar.
 * Compact levels (most → least info):
 *   "full":        messages 12.5k/30k ↓2.1k
 *   undefined:     msg 12.5k/30k ↓2.1k
 *   "noBuffer":    msg 12.5k/30k
 *   "percentOnly": msg 42%
 *
 * @param labelStyler - Optional function to style the label text (for animation).
 *                      Receives the raw label string, returns styled string.
 */
export function formatObservationStatus(
  state: OMProgressState,
  compact?: 'percentOnly' | 'noBuffer' | 'full',
  labelStyler?: (label: string) => string,
): string {
  // Status is now shown in the mode badge, so just show the metrics
  const percent = Math.round(state.thresholdPercent);
  const pct = colorByPercent(`${percent}%`, percent);
  const defaultStyler = (s: string) => chalk.hex(mastra.specialGray)(s);
  const styleLabel = labelStyler ?? defaultStyler;
  if (compact === 'percentOnly') {
    return styleLabel('msg ') + pct;
  }
  const label = compact === 'full' ? 'messages' : 'msg';
  const fraction = `${formatTokensValue(state.pendingTokens)}/${formatTokensThreshold(state.threshold)}`;
  const buffered =
    compact !== 'noBuffer' && state.buffered.observations.projectedMessageRemoval > 0
      ? theme.fg('muted', ` ↓${formatTokensThreshold(state.buffered.observations.projectedMessageRemoval)}`)
      : '';
  return styleLabel(`${label} `) + colorByPercent(fraction, percent) + buffered;
}
/**
 * Format OM reflection threshold for status bar.
 * Compact levels (most → least info):
 *   "full":        memory 8.2k/40k ↓1.2k
 *   undefined:     mem 8.2k/40k ↓1.2k
 *   "noBuffer":    mem 8.2k/40k
 *   "percentOnly": mem 21%
 *
 * @param labelStyler - Optional function to style the label text (for animation).
 *                      Receives the raw label string, returns styled string.
 */
export function formatReflectionStatus(
  state: OMProgressState,
  compact?: 'percentOnly' | 'noBuffer' | 'full',
  labelStyler?: (label: string) => string,
): string {
  // Status is now shown in the mode badge, so just show the metrics
  const percent = Math.round(state.reflectionThresholdPercent);
  const pct = colorByPercent(`${percent}%`, percent);
  const defaultStyler = (s: string) => chalk.hex(mastra.specialGray)(s);
  const styleLabel = labelStyler ?? defaultStyler;
  const label = styleLabel(compact === 'full' ? 'memory' : 'mem') + ' ';
  if (compact === 'percentOnly') {
    return label + pct;
  }
  const fraction = `${formatTokensValue(state.observationTokens)}/${formatTokensThreshold(state.reflectionThreshold)}`;
  const savings = state.buffered.reflection.inputObservationTokens - state.buffered.reflection.observationTokens;
  const buffered =
    compact !== 'noBuffer' && state.buffered.reflection.status === 'complete'
      ? theme.fg('muted', ` ↓${formatTokensThreshold(savings)}`)
      : '';
  return label + colorByPercent(fraction, percent) + buffered;
}

/**
 * @deprecated Use formatObservationStatus and formatReflectionStatus instead
 */
export function formatOMStatus(state: OMProgressState): string {
  return formatObservationStatus(state);
}
