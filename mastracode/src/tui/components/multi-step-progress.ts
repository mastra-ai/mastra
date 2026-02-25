/**
 * Multi-step progress indicator component for long-running operations.
 * Shows detailed progress with steps, timing, and visual feedback.
 */

import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { fg, bold, mastra } from '../theme.js';

export interface ProgressStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  progress?: number; // 0-100 for active steps
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface MultiStepProgressOptions {
  title: string;
  showTimings?: boolean;
  showStepNumbers?: boolean;
  collapsedByDefault?: boolean;
  estimatedTime?: number; // Total estimated time in ms
}

/**
 * Component that displays multi-step progress for long operations.
 * Features:
 * - Step-by-step progress tracking
 * - Time elapsed and remaining estimates
 * - Visual progress bars for active steps
 * - Expandable/collapsible detail view
 * - Error states with details
 */
export class MultiStepProgressComponent extends Container {
  private steps: ProgressStep[] = [];
  private options: Required<Omit<MultiStepProgressOptions, 'estimatedTime'>> & {
    estimatedTime?: number;
  };
  private isCollapsed: boolean;
  private startTime: number;
  private spinnerFrame = 0;
  private lastRenderTime = 0;

  constructor(options: MultiStepProgressOptions) {
    super();
    this.options = {
      showTimings: true,
      showStepNumbers: true,
      collapsedByDefault: false,
      ...options,
    };
    this.isCollapsed = this.options.collapsedByDefault;
    this.startTime = Date.now();
  }

  /**
   * Update the list of steps and re-render.
   */
  updateSteps(steps: ProgressStep[]): void {
    this.steps = steps;
    this.rebuild();
  }

  /**
   * Update a single step by ID.
   */
  updateStep(id: string, updates: Partial<ProgressStep>): void {
    const step = this.steps.find(s => s.id === id);
    if (step) {
      Object.assign(step, updates);
      if (updates.status === 'active' && !step.startTime) {
        step.startTime = Date.now();
      } else if ((updates.status === 'completed' || updates.status === 'failed') && !step.endTime) {
        step.endTime = Date.now();
      }
      this.rebuild();
    }
  }

  /**
   * Add a new step to the progress.
   */
  addStep(step: ProgressStep): void {
    this.steps.push(step);
    this.rebuild();
  }

  /**
   * Toggle collapsed/expanded state.
   */
  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();

    // Don't render if no steps
    if (this.steps.length === 0) return;

    const now = Date.now();

    // Update spinner animation frame
    if (now - this.lastRenderTime > 100) {
      this.spinnerFrame = (this.spinnerFrame + 1) % 10;
      this.lastRenderTime = now;
    }

    // Calculate overall progress
    const completed = this.steps.filter(s => s.status === 'completed').length;
    const failed = this.steps.filter(s => s.status === 'failed').length;
    const active = this.steps.filter(s => s.status === 'active').length;
    const total = this.steps.length;
    const overallProgress = Math.round((completed / total) * 100);

    // Header with title and overall progress
    const progressBar = this.renderProgressBar(overallProgress, 20);
    const elapsed = this.formatDuration(now - this.startTime);
    const headerText = `${bold(fg('accent', this.options.title))} ${progressBar} ${overallProgress}% (${elapsed})`;

    this.addChild(new Spacer(1));
    this.addChild(new Text(headerText, 0, 0));

    // Show collapsed summary or full detail
    if (this.isCollapsed) {
      // Summary line showing active step
      const activeStep = this.steps.find(s => s.status === 'active');
      if (activeStep) {
        const spinner = this.getSpinner();
        const summaryText = `  ${spinner} ${activeStep.title}${activeStep.progress ? ` (${activeStep.progress}%)` : ''}`;
        this.addChild(new Text(fg('warning', summaryText), 0, 0));
      } else if (failed > 0) {
        this.addChild(new Text(fg('error', `  ✗ ${failed} step${failed > 1 ? 's' : ''} failed`), 0, 0));
      } else if (completed === total) {
        this.addChild(new Text(fg('success', '  ✓ All steps completed'), 0, 0));
      }
    } else {
      // Full detail view
      this.steps.forEach((step, index) => {
        const stepLine = this.formatStepLine(step, index);
        this.addChild(new Text(stepLine, 0, 0));

        // Show progress bar for active steps
        if (step.status === 'active' && step.progress !== undefined) {
          const stepProgressBar = this.renderProgressBar(step.progress, 30);
          this.addChild(new Text(`      ${stepProgressBar} ${step.progress}%`, 0, 0));
        }

        // Show error details for failed steps
        if (step.status === 'failed' && step.error) {
          const errorLines = step.error.split('\n');
          errorLines.forEach(line => {
            this.addChild(new Text(fg('error', `      ${line}`), 0, 0));
          });
        }
      });

      // Show estimated time remaining if available
      if (this.options.estimatedTime && active > 0) {
        const elapsed = now - this.startTime;
        const estimatedRemaining = Math.max(0, this.options.estimatedTime - elapsed);
        if (estimatedRemaining > 0) {
          const remaining = this.formatDuration(estimatedRemaining);
          this.addChild(new Text(fg('dim', `  Est. time remaining: ${remaining}`), 0, 0));
        }
      }
    }
  }

  private formatStepLine(step: ProgressStep, index: number): string {
    const indent = '  ';
    const stepNum = this.options.showStepNumbers ? `${index + 1}. ` : '';

    let icon: string;
    let color: (text: string) => string;

    switch (step.status) {
      case 'completed':
        icon = fg('success', '✓');
        color = (t: string) => fg('success', t);
        break;
      case 'active':
        icon = fg('warning', this.getSpinner());
        color = (t: string) => bold(fg('warning', t));
        break;
      case 'failed':
        icon = fg('error', '✗');
        color = (t: string) => fg('error', t);
        break;
      case 'skipped':
        icon = fg('dim', '—');
        color = (t: string) => fg('dim', t);
        break;
      case 'pending':
      default:
        icon = fg('dim', '○');
        color = (t: string) => fg('dim', t);
        break;
    }

    let text = `${indent}${icon} ${stepNum}${step.title}`;

    // Add timing info if enabled and available
    if (this.options.showTimings && step.startTime) {
      if (step.endTime) {
        const duration = this.formatDuration(step.endTime - step.startTime);
        text += fg('dim', ` (${duration})`);
      } else if (step.status === 'active') {
        const elapsed = this.formatDuration(Date.now() - step.startTime);
        text += fg('dim', ` (${elapsed})`);
      }
    }

    return color(text);
  }

  private renderProgressBar(percent: number, width: number): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    // Color based on progress — Mastra brand colors
    if (percent === 100) {
      return chalk.hex(mastra.green)(bar); // Mastra green
    } else if (percent >= 75) {
      return chalk.hex(mastra.yellow)(bar); // Mastra yellow
    } else {
      return chalk.hex(mastra.purple)(bar); // Mastra purple
    }
  }
  private getSpinner(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    return frames[this.spinnerFrame]!;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  /**
   * Handle keyboard input for expanding/collapsing.
   */
  handleInput(data: string): boolean {
    if (data === ' ' || data === '\r') {
      this.toggleCollapsed();
      return true;
    }
    return false;
  }

  render(maxWidth: number): string[] {
    this.rebuild();
    return super.render(maxWidth);
  }
}
