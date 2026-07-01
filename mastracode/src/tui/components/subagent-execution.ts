/**
 * Subagent execution rendering component.
 * Shows real-time activity from a delegated subagent task using
 * the same bordered box style as shell/view tools:
 *  - Top border
 *  - Task description (always visible)
 *  - Streaming tool call activity (capped rolling window)
 *  - Bottom border with agent type, model, status, duration
 */

import { Container, Text } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import { safeStringify } from '@mastra/core/utils';
import chalk from 'chalk';
import { BOX_INDENT, getTermWidth, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import type { IToolExecutionComponent } from './tool-execution-interface.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SubagentActivity =
  | {
      kind: 'tool';
      name: string;
      args: unknown;
      result?: string;
      isError?: boolean;
      done: boolean;
    }
  | {
      kind: 'text';
      text: string;
    };

export type SubagentToolCall = Extract<SubagentActivity, { kind: 'tool' }>;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ACTIVITY_LINES = 15;
const COLLAPSED_LINES = 15;

export interface SubagentExecutionOptions {
  /** When true, auto-collapse to a single summary line on completion. Default false. */
  collapseOnComplete?: boolean;
  /** True when this subagent is running on a forked copy of the parent thread. */
  forked?: boolean;
  /** When true, show full completed content including the final result. Default false. */
  expandOnComplete?: boolean;
  /** Footer label before the agent type. Default "subagent". */
  label?: string;
  /** Max activity lines shown while running. Default 15. */
  maxActivityLines?: number;
  /** Max activity lines shown when completed and collapsed. Default 15. */
  collapsedLines?: number;
  colors?: {
    border?: string;
    label?: string;
    agentType?: string;
    icon?: string;
  };
  icons?: {
    running?: string;
    success?: string;
    error?: string;
  };
}

export class SubagentExecutionComponent extends Container implements IToolExecutionComponent {
  private ui: TUI;

  // State
  private agentType: string;
  private task: string;
  private modelId?: string;
  private activity: SubagentActivity[] = [];
  private lastTextSnapshot = '';
  private done = false;
  private isError = false;
  private startTime = Date.now();
  private durationMs = 0;
  private finalResult?: string;
  private expanded = false;
  private collapseOnComplete: boolean;
  private expandOnComplete: boolean;
  private forked: boolean;
  private label: string;
  private maxActivityLines: number;
  private collapsedLines: number;
  private colors: NonNullable<SubagentExecutionOptions['colors']>;
  private icons: Required<NonNullable<SubagentExecutionOptions['icons']>>;

  constructor(agentType: string, task: string, ui: TUI, modelId?: string, options?: SubagentExecutionOptions) {
    super();
    this.agentType = agentType;
    this.task = task;
    this.modelId = modelId;
    this.ui = ui;
    this.collapseOnComplete = options?.collapseOnComplete ?? false;
    this.expandOnComplete = options?.expandOnComplete ?? false;
    this.forked = options?.forked ?? false;
    this.label = options?.label ?? 'subagent';
    this.maxActivityLines = clampPositiveInt(options?.maxActivityLines, MAX_ACTIVITY_LINES);
    this.collapsedLines = clampPositiveInt(options?.collapsedLines, COLLAPSED_LINES);
    this.colors = options?.colors ?? {};
    this.icons = {
      running: options?.icons?.running ?? '⋯',
      success: options?.icons?.success ?? '✓',
      error: options?.icons?.error ?? '✗',
    };

    this.rebuild();
  }

  // ── Mutation API ──────────────────────────────────────────────────────

  addToolStart(name: string, args: unknown): void {
    this.activity.push({ kind: 'tool', name, args, done: false });
    this.rebuild();
  }

  setTask(task: string): void {
    this.task = task;
    this.rebuild();
  }

  setText(text: string): void {
    const nextSnapshot = text.trim();
    if (!nextSnapshot || nextSnapshot === this.lastTextSnapshot) return;

    const last = this.activity.at(-1);
    const extendsPreviousSnapshot = Boolean(this.lastTextSnapshot && nextSnapshot.startsWith(this.lastTextSnapshot));
    let textToRender = nextSnapshot;
    if (extendsPreviousSnapshot) {
      const delta = nextSnapshot.slice(this.lastTextSnapshot.length);
      textToRender = last?.kind === 'text' ? delta : delta.trimStart();
    }
    this.lastTextSnapshot = nextSnapshot;
    if (!textToRender) return;

    if (last?.kind === 'text') {
      last.text = extendsPreviousSnapshot ? `${last.text}${textToRender}` : textToRender;
    } else {
      this.activity.push({ kind: 'text', text: textToRender });
    }
    this.rebuild();
  }

  addText(text: string): void {
    this.setText(text);
  }

  addToolEnd(name: string, result: unknown, isError: boolean): void {
    for (let i = this.activity.length - 1; i >= 0; i--) {
      const item = this.activity[i]!;
      if (item.kind === 'tool' && item.name === name && !item.done) {
        item.done = true;
        item.isError = isError;
        item.result = typeof result === 'string' ? result : safeStringify(result ?? '');
        break;
      }
    }
    this.rebuild();
  }

  finish(isError: boolean, durationMs: number, result?: string): void {
    this.done = true;
    this.isError = isError;
    this.durationMs = durationMs;
    this.finalResult = isDuplicateFinalResult(result, this.activity, this.lastTextSnapshot) ? undefined : result;
    if (this.expandOnComplete) {
      this.expanded = true;
    } else if (this.collapseOnComplete) {
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

  getChatSpacingKind(): ChatSpacingKind {
    return 'normal-tool';
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  private rebuild(): void {
    this.clear();

    const border = (char: string) =>
      theme.bold(colorText(this.colors.border, char, (text: string) => theme.fg('accent', text)));
    const termWidth = getTermWidth();
    const maxLineWidth = termWidth - 6 - BOX_INDENT * 2;

    // ── Bottom border with info (always rendered) ──
    const typeLabelText = this.forked ? 'fork' : this.agentType;
    const typeLabel = theme.bold(
      colorText(this.colors.agentType, typeLabelText, (text: string) => theme.fg('accent', text)),
    );
    const modelLabel = this.modelId ? theme.fg('muted', ` ${this.modelId}`) : '';
    const statusIcon = this.done
      ? this.isError
        ? colorText(this.colors.icon, ` ${this.icons.error}`, (text: string) => theme.fg('error', text))
        : colorText(this.colors.icon, ` ${this.icons.success}`, (text: string) => theme.fg('success', text))
      : colorText(this.colors.icon, ` ${this.icons.running}`, (text: string) => theme.fg('muted', text));
    const durationStr = this.done ? theme.fg('muted', ` ${formatDuration(this.durationMs)}`) : '';
    const footerText = `${theme.bold(colorText(this.colors.label, this.label, (text: string) => theme.fg('toolTitle', text)))} ${typeLabel}${modelLabel}${durationStr}${statusIcon}`;

    // When collapse-on-complete is enabled, render only the single-line footer summary.
    // Quiet mode does not enable this for subagents; it is kept for explicit callers/tests.
    if (this.collapseOnComplete && this.done && !this.expanded) {
      this.addChild(new Text(`${border('╰──')} ${footerText}`, BOX_INDENT, 0));
      this.invalidate();
      this.ui.requestRender();
      return;
    }

    // ── Top border ──
    this.addChild(new Text(border('╭──'), BOX_INDENT, 0));

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
    this.addChild(new Text(taskContent, BOX_INDENT, 0));

    if (taskTruncated) {
      const moreText = theme.fg('muted', `... ${wrappedTaskLines.length - maxTaskLines} more lines (ctrl+e to expand)`);
      this.addChild(new Text(`${border('│')} ${moreText}`, BOX_INDENT, 0));
    }

    // ── Activity lines (assistant text and tool calls — capped rolling window) ──
    if (this.activity.length > 0) {
      // Separator between task and activity
      this.addChild(new Text(`${border('│')} ${theme.fg('muted', '───')}`, BOX_INDENT, 0));

      const activityLines = this.activity.flatMap(item =>
        formatActivityLine(item, maxLineWidth, this.icons, this.colors.icon),
      );

      // While streaming: rolling window. When done: collapsible.
      const cap = this.done ? this.collapsedLines : this.maxActivityLines;
      let displayLines = activityLines;
      let hiddenCount = 0;
      const minHidden = this.done ? 2 : 1;
      if (!this.expanded && activityLines.length > cap + minHidden - 1) {
        hiddenCount = activityLines.length - cap;
        displayLines = activityLines.slice(-cap);
      }

      if (hiddenCount > 0) {
        const hiddenText = theme.fg(
          'muted',
          `  ... ${hiddenCount} more above${this.done ? ' (ctrl+e to expand)' : ''}`,
        );
        this.addChild(new Text(`${border('│')} ${hiddenText}`, BOX_INDENT, 0));
      }

      const activityContent = displayLines.map(line => `${border('│')} ${line}`).join('\n');
      this.addChild(new Text(activityContent, BOX_INDENT, 0));
    }

    // ── Final result (shown after completion, only when expanded) ──
    if (this.done && this.finalResult && this.expanded) {
      this.addChild(new Text(`${border('│')} ${theme.fg('muted', '───')}`, BOX_INDENT, 0));
      const resultLines = this.finalResult!.split('\n');

      const resultContent = resultLines
        .map(line => {
          const truncatedLine = line.length > maxLineWidth ? line.slice(0, maxLineWidth - 1) + '…' : line;
          return `${border('│')} ${theme.fg('muted', truncatedLine)}`;
        })
        .join('\n');
      if (resultContent.trim()) {
        this.addChild(new Text(resultContent, BOX_INDENT, 0));
      }
    }

    // ── Bottom border ──
    this.addChild(new Text(`${border('╰──')} ${footerText}`, BOX_INDENT, 0));

    this.invalidate();
    this.ui.requestRender();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clampPositiveInt(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function colorText(color: string | undefined, text: string, fallback: (text: string) => string): string {
  if (!color) return fallback(text);
  try {
    return chalk.hex(color)(text);
  } catch {
    return fallback(text);
  }
}

function formatActivityLine(
  activity: SubagentActivity,
  maxWidth: number,
  icons: Required<NonNullable<SubagentExecutionOptions['icons']>>,
  iconColor?: string,
): string[] {
  if (activity.kind === 'text') return formatTextActivityLines(activity.text, maxWidth);
  return [formatToolCallLine(activity, maxWidth, icons, iconColor)];
}

function formatTextActivityLines(text: string, maxWidth: number): string[] {
  return text
    .trim()
    .split('\n')
    .map(line => theme.fg('muted', line.length > maxWidth ? `${line.slice(0, maxWidth - 1)}…` : line));
}

function formatToolCallLine(
  tc: SubagentToolCall,
  maxWidth: number,
  icons: Required<NonNullable<SubagentExecutionOptions['icons']>>,
  iconColor?: string,
): string {
  const iconText = tc.done ? (tc.isError ? icons.error : icons.success) : icons.running;
  const icon = tc.done
    ? tc.isError
      ? colorText(iconColor, iconText, (text: string) => theme.fg('error', text))
      : colorText(iconColor, iconText, (text: string) => theme.fg('success', text))
    : colorText(iconColor, iconText, (text: string) => theme.fg('muted', text));
  const name = theme.fg('toolTitle', tc.name);
  const prefix = `${icon} ${name}`;
  const argsSummary = summarizeArgs(tc.args, Math.max(20, maxWidth - stripAnsi(prefix).length - 1));
  return `${prefix} ${argsSummary}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isDuplicateFinalResult(
  result: string | undefined,
  activity: SubagentActivity[],
  lastTextSnapshot: string,
): boolean {
  if (!result) return false;
  if (lastTextSnapshot && normalizeText(lastTextSnapshot) === normalizeText(result)) return true;
  const textItems = activity.filter(
    (item): item is Extract<SubagentActivity, { kind: 'text' }> => item.kind === 'text',
  );
  const lastText = textItems.at(-1)?.text;
  return lastText ? normalizeText(lastText) === normalizeText(result) : false;
}

function summarizeArgs(args: unknown, maxWidth = 40): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  const parts: string[] = [];

  // Special handling for task list snapshots.
  if (obj.tasks && Array.isArray(obj.tasks)) {
    const maxTasksInSummary = 5;
    const tasks = obj.tasks as Array<{
      content?: string;
      status?: string;
      activeForm?: string;
    }>;
    const visibleTasks = tasks.slice(0, maxTasksInSummary);
    const taskSummaries = visibleTasks.map(t => {
      const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
      const content = t.content || t.activeForm || 'task';
      return `${icon} ${content}`;
    });
    const extraCount = tasks.length - visibleTasks.length;
    if (extraCount > 0) {
      taskSummaries.push(`… +${extraCount} more`);
    }
    return theme.fg('muted', taskSummaries.join(', '));
  }

  let remainingWidth = maxWidth;
  for (const [_key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      const short = val.length > remainingWidth ? val.slice(0, Math.max(1, remainingWidth - 1)) + '…' : val;
      parts.push(theme.fg('muted', short));
      remainingWidth -= short.length + 1;
    } else if (Array.isArray(val)) {
      parts.push(theme.fg('muted', `${val.length} items`));
    } else if (typeof val === 'object' && val !== null) {
      parts.push(theme.fg('muted', '{...}'));
    }
  }
  return parts.join(' ');
}
