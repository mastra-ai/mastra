/**
 * Streaming shell output component for the shell passthrough (! command).
 * Shows a bordered box with live stdout/stderr and a status footer.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import { getTermWidth, theme } from '../theme.js';
import { truncateAnsi } from './ansi.js';

const MAX_LINES = 200;
const COLLAPSED_LINES = 20;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
}

export class ShellStreamComponent extends Container {
  private command: string;
  private lines: string[] = [];
  private trailingPartial = '';
  private exitCode?: number;
  private startTime = Date.now();
  private expanded = false;

  constructor(command: string) {
    super();
    this.command = command;
    this.rebuild();
  }

  appendOutput(text: string): void {
    const combined = this.trailingPartial + text;
    const parts = combined.split('\n');
    // Last element is either '' (if text ended with \n) or an incomplete line
    this.trailingPartial = parts.pop()!;
    this.lines.push(...parts);
    if (this.lines.length > MAX_LINES) {
      this.lines = this.lines.slice(-MAX_LINES);
    }
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  finish(exitCode: number): void {
    // Flush any trailing partial line
    if (this.trailingPartial) {
      this.lines.push(this.trailingPartial);
      this.trailingPartial = '';
      if (this.lines.length > MAX_LINES) {
        this.lines = this.lines.slice(-MAX_LINES);
      }
    }
    this.exitCode = exitCode;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));

    const border = (char: string) => theme.bold(theme.fg('accent', char));
    const termWidth = getTermWidth();
    const maxLineWidth = termWidth - 6;

    const done = this.exitCode !== undefined;
    const statusIcon = done
      ? this.exitCode === 0
        ? theme.fg('success', ' ✓')
        : theme.fg('error', ' ✗')
      : theme.fg('muted', ' ⋯');

    const durationStr = done ? theme.fg('muted', ` ${formatDuration(Date.now() - this.startTime)}`) : '';
    const footerText = `${theme.bold(theme.fg('toolTitle', '$'))} ${theme.fg('accent', this.command)}${durationStr}${statusIcon}`;

    // Top border
    this.addChild(new Text(border('╭──'), 0, 0));

    // Output lines with left border
    const displayLines = [...this.lines];
    // Include trailing partial if still streaming
    if (this.trailingPartial && !done) {
      displayLines.push(this.trailingPartial);
    }
    // Remove leading empty lines
    while (displayLines.length > 0 && displayLines[0] === '') displayLines.shift();

    if (displayLines.length > 0) {
      const maxVisible = this.expanded ? MAX_LINES : COLLAPSED_LINES;
      const truncated = displayLines.length > maxVisible;
      const visibleLines = truncated ? displayLines.slice(-maxVisible) : displayLines;

      const borderedLines = visibleLines.map(line => {
        const truncatedLine = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + truncatedLine;
      });

      if (truncated) {
        const remaining = displayLines.length - maxVisible;
        const action = this.expanded ? 'collapse' : 'expand';
        borderedLines.push(border('│') + ' ' + theme.fg('muted', `... ${remaining} more lines (Ctrl+E to ${action})`));
      }

      const displayOutput = borderedLines.join('\n');
      if (displayOutput.trim()) {
        this.addChild(new Text(displayOutput, 0, 0));
      }
    }

    // Bottom border with command info
    this.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));

    // Show exit code if non-zero
    if (done && this.exitCode !== 0) {
      this.addChild(new Text(theme.fg('error', `  Exit code: ${this.exitCode}`), 0, 0));
    }

    this.invalidate();
  }
}
