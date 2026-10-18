/**
 * JudgeDisplayComponent — renders the goal judge's decision inline in the chat.
 */

import { Text } from '@earendil-works/pi-tui';
import type { GoalEvaluationPayload } from '@mastra/core/stream';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

import { stripControlChars } from '../sanitize-ansi.js';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { WidthAwareContainer } from './width-aware-container.js';

/** Display-only decision derived from a goal evaluation. */
export interface GoalJudgeResult {
  decision: 'done' | 'continue' | 'waiting' | 'paused';
  reason: string;
}

/** Map a core {@link GoalEvaluationPayload} to a display decision. */
export function evaluationToJudgeResult(payload: GoalEvaluationPayload): GoalJudgeResult {
  const decision: GoalJudgeResult['decision'] = payload.passed
    ? 'done'
    : payload.waitingForUser
      ? 'waiting'
      : payload.status === 'paused'
        ? 'paused'
        : 'continue';
  return { decision, reason: payload.reason ?? '' };
}

// Resolved lazily so theme switches and contrast adaptation apply.
const judgeColor = () => mastra.blue;

export class JudgeDisplayComponent extends WidthAwareContainer {
  private result: GoalJudgeResult | null;
  private turnsUsed: number;
  private maxTurns: number;
  private activity: string[] = [];
  private streamingReason = '';

  constructor(result: GoalJudgeResult | null = null, turnsUsed = 0, maxTurns = 0) {
    super();
    this.result = result;
    this.turnsUsed = turnsUsed;
    this.maxTurns = maxTurns;
    this.rebuild();
  }

  addActivity(rawLine: string): void {
    // Activity lines interpolate raw judge tool arguments.
    const line = stripControlChars(rawLine);
    if (this.activity[this.activity.length - 1] !== line) {
      this.activity.push(line);
    }
    if (this.activity.length > 6) {
      this.activity = this.activity.slice(-6);
    }
    this.rebuild();
  }

  setStreamingReason(reason: string): void {
    this.streamingReason = reason;
    this.rebuild();
  }

  setResult(result: GoalJudgeResult, turnsUsed: number, maxTurns: number): void {
    this.result = result;
    this.streamingReason = '';
    this.turnsUsed = turnsUsed;
    this.maxTurns = maxTurns;
    this.rebuild();
  }

  /** Render the result of an in-loop goal evaluation chunk. */
  setEvaluation(payload: GoalEvaluationPayload): void {
    this.setResult(evaluationToJudgeResult(payload), payload.iteration, payload.maxRuns);
  }

  setInterrupted(): void {
    this.setResult({ decision: 'paused', reason: 'Judge evaluation was interrupted.' }, this.turnsUsed, this.maxTurns);
  }

  protected rebuildForWidth(termWidth: number): void {
    this.clear();

    const border = (char: string) => chalk.hex(judgeColor())(char);
    const title = chalk.hex(judgeColor()).bold('Goal');
    const innerWidth = Math.max(20, termWidth - BOX_INDENT * 2 - 2);

    this.addChild(new Text(this.renderRow(this.renderHeader(title), innerWidth, border), BOX_INDENT, 0));

    if (!this.result && this.activity.length === 0 && !this.streamingReason) {
      this.addChild(new Text(this.renderRow(chalk.dim('evaluating…'), innerWidth, border), BOX_INDENT, 0));
    }

    for (const line of this.activity) {
      this.addChild(new Text(this.renderRow(this.renderActivityLine(line), innerWidth, border), BOX_INDENT, 0));
    }

    if (this.activity.length > 0 && (this.result || this.streamingReason)) {
      this.addChild(new Text(this.renderRow('', innerWidth, border), BOX_INDENT, 0));
    }

    // The reason can be provider/scorer error text on a judge failure.
    const reason = stripControlChars(this.result?.reason ?? this.streamingReason);
    if (reason) {
      for (const line of this.wrapLine(reason, innerWidth)) {
        this.addChild(new Text(this.renderRow(chalk.dim(line), innerWidth, border), BOX_INDENT, 0));
      }
    }
  }

  private renderActivityLine(line: string): string {
    const toolName = getActivityToolName(line);
    if (!toolName) return theme.fg('dim', `• ${line}`);

    const rest = line.slice(toolName.length);
    return `${theme.fg('dim', '• ')}${theme.fg('dim', theme.italic(toolName))}${theme.fg('dim', rest)}`;
  }

  private renderHeader(title: string): string {
    if (!this.result) {
      return `${title}  ◌ ${theme.bold(theme.fg('muted', 'evaluating'))}`;
    }

    const decisionIcon =
      this.result.decision === 'done'
        ? '●'
        : this.result.decision === 'paused'
          ? '!'
          : this.result.decision === 'waiting'
            ? '◌'
            : '○';
    const decisionText = getDecisionText(this.result.decision);
    const turnInfo = this.maxTurns > 0 ? theme.fg('muted', `(${this.turnsUsed}/${this.maxTurns})`) : '';
    return `${title}  ${decisionIcon} ${decisionText}${turnInfo ? `  ${turnInfo}` : ''}`;
  }

  /** A row of the left-bar card (`width` is the room for text after the bar). */
  private renderRow(text: string, width: number, border: (char: string) => string): string {
    return text ? `${border('▎')} ${this.padLine(text, width)}` : border('▎');
  }

  private wrapLine(text: string, width: number): string[] {
    const lines: string[] = [];
    let remaining = text;
    while (remaining.length > width) {
      const breakAt = remaining.lastIndexOf(' ', width);
      const splitAt = breakAt > 0 ? breakAt : width;
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
    return lines;
  }

  private padLine(text: string, width: number): string {
    const visibleLength = stripAnsi(text).length;
    if (visibleLength >= width) {
      return stripAnsi(text).slice(0, width);
    }
    return text + ' '.repeat(width - visibleLength);
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
  }
}

function getActivityToolName(line: string): string | null {
  if (line.startsWith('find files ')) return 'find files';
  const [toolName] = line.split(' ');
  return toolName || null;
}

function getDecisionText(decision: GoalJudgeResult['decision']): string {
  if (decision === 'done') return theme.bold(theme.fg('success', 'done'));
  if (decision === 'paused') return theme.bold(theme.fg('warning', 'paused'));
  if (decision === 'waiting') return theme.bold(theme.fg('muted', 'waiting'));
  return chalk.hex(judgeColor()).bold('continue');
}
