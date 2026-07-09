/**
 * Observational Memory progress indicator component.
 * Shows when OM is observing or reflecting on conversation history.
 */
import { Container, Text } from '@earendil-works/pi-tui';
import { defaultOMProgressState } from '@mastra/core/agent-controller';
import type { OMBufferedStatus, OMProgressState, OMStatus } from '@mastra/core/agent-controller';
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

interface OMContextIndicator {
  plain: string;
  styled: string;
  messageCells: number;
  memoryCells: number;
  unusedCells: number;
}

interface OMContextIndicatorStylers {
  messages?: (segment: string) => string;
  memory?: (segment: string) => string;
}

export function formatOMContextIndicator(
  state: OMProgressState,
  stylers: OMContextIndicatorStylers = {},
): OMContextIndicator {
  const used = Math.max(0, state.pendingTokens) + Math.max(0, state.observationTokens);
  const capacity = Math.max(0, state.threshold) + Math.max(0, state.reflectionThreshold);
  const occupiedCells = capacity === 0 ? 0 : Math.max(0, Math.min(10, Math.round((used / capacity) * 10)));

  let messageCells = used === 0 ? 0 : Math.round((Math.max(0, state.pendingTokens) / used) * occupiedCells);
  if (state.pendingTokens > 0 && state.observationTokens > 0 && occupiedCells >= 2) {
    messageCells = Math.max(1, Math.min(occupiedCells - 1, messageCells));
  }
  const memoryCells = occupiedCells - messageCells;
  const unusedCells = 10 - occupiedCells;

  const messageSegment = '━'.repeat(messageCells);
  const unusedSegment = '─'.repeat(unusedCells);
  const memorySegment = '━'.repeat(memoryCells);
  const fraction = `${formatTokensValue(used)}/${formatTokensThreshold(capacity)}`;
  const messageSavings = Math.max(0, state.buffered.observations.projectedMessageRemoval);
  const reflectionSavings = Math.max(
    0,
    state.buffered.reflection.inputObservationTokens - state.buffered.reflection.observationTokens,
  );
  const savings = messageSavings + reflectionSavings;
  const suffix = savings > 0 ? ` ↓${formatTokensThreshold(savings)}` : '';

  const plain = `[${messageSegment}${unusedSegment}${memorySegment}] ${fraction}${suffix}`;
  const styleMessages = stylers.messages ?? (segment => chalk.hex(mastra.orange)(segment));
  const styleMemory = stylers.memory ?? (segment => chalk.hex(mastra.pink)(segment));
  const styled =
    theme.fg('muted', '[') +
    styleMessages(messageSegment) +
    theme.fg('muted', unusedSegment) +
    styleMemory(memorySegment) +
    theme.fg('muted', `] ${fraction}`) +
    (suffix ? chalk.italic(theme.fg('muted', suffix)) : '');

  return { plain, styled, messageCells, memoryCells, unusedCells };
}

/** @deprecated Retained for backward compatibility. */
export function formatOMStatus(state: OMProgressState): string {
  const percent = Math.round(state.thresholdPercent);
  const fraction = `${formatTokensValue(state.pendingTokens)}/${formatTokensThreshold(state.threshold)}`;
  const value =
    percent >= 90
      ? chalk.hex(mastra.red)(fraction)
      : percent >= 70
        ? chalk.hex(mastra.orange)(fraction)
        : chalk.hex('#71717a')(fraction);
  const savings = state.buffered.observations.projectedMessageRemoval;
  const buffered = savings > 0 ? chalk.italic(theme.fg('muted', ` ↓${formatTokensThreshold(savings)}`)) : '';
  return chalk.hex(mastra.specialGray)('msg ') + value + buffered;
}
