/**
 * Streaming shell output component for the shell passthrough (! command).
 * A tool-style block: "● $ command" with live stdout/stderr on a shaded panel below.
 */

import { Text } from '@earendil-works/pi-tui';
import { theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { statusDot, toolBlock } from './surface.js';
import { WidthAwareContainer } from './width-aware-container.js';

const MAX_LINES = 200;
const COLLAPSED_LINES = 20;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
}

export class ShellStreamComponent extends WidthAwareContainer {
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

  protected rebuildForWidth(termWidth: number): void {
    this.clear();

    const done = this.exitCode !== undefined;
    const failed = done && this.exitCode !== 0;
    const durationStr = done ? theme.fg('muted', ` ${formatDuration(Date.now() - this.startTime)}`) : '';
    const title = `${theme.bold(theme.fg('toolTitle', '$'))} ${theme.fg('toolArgs', this.command)}${durationStr}${failed ? theme.fg('error', ' ✗') : ''}`;

    const displayLines = [...this.lines];
    // Include trailing partial if still streaming
    if (this.trailingPartial && !done) {
      displayLines.push(this.trailingPartial);
    }
    // Remove leading empty lines
    while (displayLines.length > 0 && displayLines[0] === '') displayLines.shift();

    const maxVisible = this.expanded ? MAX_LINES : COLLAPSED_LINES;
    const truncated = displayLines.length > maxVisible;
    const output = (truncated ? displayLines.slice(-maxVisible) : displayLines).map(line =>
      theme.fg('toolOutput', line),
    );
    if (truncated) {
      const remaining = displayLines.length - maxVisible;
      const action = this.expanded ? 'collapse' : 'expand';
      output.unshift(
        theme.fg('dim', `… ${remaining} earlier lines · `) +
          theme.fg('muted', 'ctrl+e') +
          theme.fg('dim', ` to ${action}`),
      );
    }
    if (failed) output.push(theme.fg('error', `Exit code: ${this.exitCode}`));

    const dot = statusDot(done ? (failed ? 'error' : 'done') : 'running');
    const hasOutput = output.some(line => line.trim());
    this.addChild(new Text(toolBlock(dot, title, hasOutput ? output : [], termWidth).join('\n'), 0, 0));

    this.invalidate();
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
  }
}
