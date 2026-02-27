/**
 * Subagent execution rendering component.
 * Shows real-time activity from a delegated subagent task using
 * the same bordered box style as shell/view tools:
 *  - Top border
 *  - Task description (always visible)
 *  - Streaming tool call activity (capped rolling window)
 *  - Bottom border with agent type, model, status, duration
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';
import type { IToolExecutionComponent } from './tool-execution-interface.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SubagentToolCall {
  name: string;
  args: unknown;
  result?: string;
  isError?: boolean;
  done: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ACTIVITY_LINES = 15;
const COLLAPSED_LINES = 15;

export interface SubagentExecutionOptions {
  /** When true, auto-collapse to a single summary line on completion. Default false. */
  collapseOnComplete?: boolean;
}

export class SubagentExecutionComponent extends Container implements IToolExecutionComponent {
  private ui: TUI;

  // State
  private agentType: string;
  private task: string;
  private modelId?: string;
  private toolCalls: SubagentToolCall[] = [];
  private done = false;
  private isError = false;
  private startTime = Date.now();
  private durationMs = 0;
  private finalResult?: string;
  private expanded = false;
  private collapseOnComplete: boolean;

  constructor(agentType: string, task: string, ui: TUI, modelId?: string, options?: SubagentExecutionOptions) {
    super();
    this.agentType = agentType;
    this.task = task;
    this.modelId = modelId;
    this.ui = ui;
    this.collapseOnComplete = options?.collapseOnComplete ?? false;

    this.rebuild();
  }

  // ── Mutation API ──────────────────────────────────────────────────────

  addToolStart(name: string, args: unknown): void {
    this.toolCalls.push({ name, args, done: false });
    this.rebuild();
  }
  addToolEnd(name: string, result: unknown, isError: boolean): void {
    for (let i = this.toolCalls.length - 1; i >= 0; i--) {
      const toolCall = this.toolCalls[i]!;
      if (toolCall.name === name && !toolCall.done) {
        toolCall.done = true;
        toolCall.isError = isError;
        toolCall.result = typeof result === 'string' ? result : JSON.stringify(result ?? '');
        break;
      }
    }
    this.rebuild();
  }

  finish(isError: boolean, durationMs: number, result?: string): void {
    this.done = true;
    this.isError = isError;
    this.durationMs = durationMs;
    this.finalResult = result;
    if (this.collapseOnComplete) {
      this.expanded = false;
    }
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.rebuild();
  }

  // IToolExecutionComponent interface methods
  updateArgs(_args: unknown): void {}
  updateResult(_result: unknown, _isPartial: boolean): void {}

  // ── Rendering ──────────────────────────────────────────────────────────

  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));

    const border = (char: string) => theme.bold(theme.fg('accent', char));
    const termWidth = process.stdout.columns || 80;
    const maxLineWidth = termWidth - 6;

    // ── Bottom border with info (always rendered) ──
    const typeLabel = theme.bold(theme.fg('accent', this.agentType));
    const modelLabel = this.modelId ? theme.fg('muted', ` ${this.modelId}`) : '';
    const statusIcon = this.done
      ? this.isError
        ? theme.fg('error', ' ✗')
        : theme.fg('success', ' ✓')
      : theme.fg('muted', ' ⋯');
    const durationStr = this.done ? theme.fg('muted', ` ${formatDuration(this.durationMs)}`) : '';
    const footerText = `${theme.bold(theme.fg('toolTitle', 'subagent'))} ${typeLabel}${modelLabel}${durationStr}${statusIcon}`;

    // When collapse-on-complete is enabled, render only the single-line footer summary
    if (this.collapseOnComplete && this.done && !this.expanded) {
      this.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
      this.invalidate();
      this.ui.requestRender();
      return;
    }

    // ── Top border ──
    this.addChild(new Text(border('┌──'), 0, 0));

    // ── Task description (capped when collapsed) ──
    const taskLines = this.task.split('\n');
    const wrappedTaskLines: string[] = [];
    for (const line of taskLines) {
      if (line.length > maxLineWidth) {
        let remaining = line;
        while (remaining.length > maxLineWidth) {
          const breakAt = remaining.lastIndexOf(' ', maxLineWidth);
          const splitAt = breakAt > 0 ? breakAt : maxLineWidth;
          wrappedTaskLines.push(remaining.slice(0, splitAt));
          remaining = remaining.slice(splitAt).trimStart();
        }
        if (remaining) wrappedTaskLines.push(remaining);
      } else {
        wrappedTaskLines.push(line);
      }
    }
    const maxTaskLines = 5;
    const taskTruncated = !this.expanded && wrappedTaskLines.length > maxTaskLines + 1;
    const displayTaskLines = taskTruncated ? wrappedTaskLines.slice(0, maxTaskLines) : wrappedTaskLines;

    const taskContent = displayTaskLines.map(line => `${border('│')} ${line}`).join('\n');
    this.addChild(new Text(taskContent, 0, 0));

    if (taskTruncated) {
      const moreText = theme.fg('muted', `... ${wrappedTaskLines.length - maxTaskLines} more lines (ctrl+e to expand)`);
      this.addChild(new Text(`${border('│')} ${moreText}`, 0, 0));
    }

    // ── Activity lines (tool calls — capped rolling window) ──
    if (this.toolCalls.length > 0) {
      // Separator between task and activity
      this.addChild(new Text(`${border('│')} ${theme.fg('muted', '───')}`, 0, 0));

      const activityLines = this.toolCalls.map(tc => formatToolCallLine(tc, maxLineWidth));

      // While streaming: rolling window. When done: collapsible.
      const cap = this.done ? COLLAPSED_LINES : MAX_ACTIVITY_LINES;
      let displayLines = activityLines;
      let hiddenCount = 0;
      const minHidden = this.done ? 2 : 1;
      if (!this.expanded && activityLines.length > cap + minHidden - 1) {
        hiddenCount = activityLines.length - cap;
        if (this.done) {
          // Show first N lines when collapsed (completed)
          displayLines = activityLines.slice(0, cap);
        } else {
          // Show last N lines while streaming
          displayLines = activityLines.slice(-cap);
        }
      }

      if (!this.done && hiddenCount > 0) {
        const hiddenText = theme.fg('muted', `  ... ${hiddenCount} more above`);
        this.addChild(new Text(`${border('│')} ${hiddenText}`, 0, 0));
      }

      const activityContent = displayLines.map(line => `${border('│')} ${line}`).join('\n');
      this.addChild(new Text(activityContent, 0, 0));

      if (this.done && hiddenCount > 0) {
        const moreText = theme.fg('muted', `... ${hiddenCount} more (ctrl+e to expand)`);
        this.addChild(new Text(`${border('│')} ${moreText}`, 0, 0));
      }
    }

    // ── Final result (shown after completion, only when expanded) ──
    if (this.done && this.finalResult && this.expanded) {
      this.addChild(new Text(`${border('│')} ${theme.fg('muted', '───')}`, 0, 0));
      const resultLines = this.finalResult!.split('\n');

      const resultContent = resultLines
        .map(line => {
          const truncatedLine = line.length > maxLineWidth ? line.slice(0, maxLineWidth - 1) + '…' : line;
          return `${border('│')} ${theme.fg('muted', truncatedLine)}`;
        })
        .join('\n');
      if (resultContent.trim()) {
        this.addChild(new Text(resultContent, 0, 0));
      }
    }

    // ── Bottom border ──
    this.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));

    this.invalidate();
    this.ui.requestRender();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatToolCallLine(tc: SubagentToolCall, _maxWidth: number): string {
  const icon = tc.done ? (tc.isError ? theme.fg('error', '✗') : theme.fg('success', '✓')) : theme.fg('muted', '⋯');
  const name = theme.fg('toolTitle', tc.name);
  const argsSummary = summarizeArgs(tc.args);
  return `${icon} ${name} ${argsSummary}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  const parts: string[] = [];

  // Special handling for task_write tool
  if (obj.tasks && Array.isArray(obj.tasks)) {
    const tasks = obj.tasks as Array<{
      content?: string;
      status?: string;
      activeForm?: string;
    }>;
    const taskSummaries = tasks.map(t => {
      const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
      const content = t.content || t.activeForm || 'task';
      return `${icon} ${content}`;
    });
    return theme.fg('muted', taskSummaries.join(', '));
  }

  for (const [_key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      const short = val.length > 40 ? val.slice(0, 40) + '…' : val;
      parts.push(theme.fg('muted', short));
    } else if (Array.isArray(val)) {
      parts.push(theme.fg('muted', `${val.length} items`));
    } else if (typeof val === 'object' && val !== null) {
      parts.push(theme.fg('muted', '{...}'));
    }
  }
  return parts.join(' ');
}
