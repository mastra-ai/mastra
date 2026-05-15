/**
 * JudgeDisplayComponent — renders the goal judge's decision inline in the chat.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

import type { GoalJudgeResult } from '../goal-manager.js';
import { BOX_INDENT, getTermWidth, mastraBrand, theme } from '../theme.js';

const JUDGE_COLOR = mastraBrand.blue;
const MUTED_COLOR = '#8a8a8a';
const PAUSED_COLOR = '#f5a524';
const WAITING_COLOR = '#8a8a8a';

export class JudgeDisplayComponent extends Container {
  private result: GoalJudgeResult | null;
  private turnsUsed: number;
  private maxTurns: number;
  private activity: string[] = [];

  constructor(result: GoalJudgeResult | null = null, turnsUsed = 0, maxTurns = 0) {
    super();
    this.result = result;
    this.turnsUsed = turnsUsed;
    this.maxTurns = maxTurns;
    this.renderContent();
  }

  addActivity(line: string): void {
    if (this.activity[this.activity.length - 1] !== line) {
      this.activity.push(line);
    }
    if (this.activity.length > 6) {
      this.activity = this.activity.slice(-6);
    }
    this.renderContent();
  }

  setResult(result: GoalJudgeResult, turnsUsed: number, maxTurns: number): void {
    this.result = result;
    this.turnsUsed = turnsUsed;
    this.maxTurns = maxTurns;
    this.renderContent();
  }

  setInterrupted(): void {
    this.setResult({ decision: 'paused', reason: 'Judge evaluation was interrupted.' }, this.turnsUsed, this.maxTurns);
  }

  private renderContent(): void {
    this.clear();

    const border = (char: string) => chalk.hex(JUDGE_COLOR)(char);
    const title = chalk.hex(JUDGE_COLOR).bold('Goal');
    const termWidth = getTermWidth();
    const innerWidth = Math.max(20, termWidth - BOX_INDENT * 2 - 4);
    const horizontal = '─'.repeat(innerWidth + 1);

    this.addChild(new Spacer(1));
    this.addChild(new Text(`${border('╭')}${border(horizontal)}${border('╮')}`, BOX_INDENT, 0));
    this.addChild(new Text(this.renderRow(this.renderHeader(title), innerWidth, border), BOX_INDENT, 0));

    if (!this.result && this.activity.length === 0) {
      this.addChild(new Text(this.renderRow(chalk.dim('evaluating…'), innerWidth, border), BOX_INDENT, 0));
    }

    for (const line of this.activity) {
      this.addChild(new Text(this.renderRow(this.renderActivityLine(line), innerWidth, border), BOX_INDENT, 0));
    }

    if (this.activity.length > 0 && this.result) {
      this.addChild(new Text(this.renderRow('', innerWidth, border), BOX_INDENT, 0));
    }

    if (this.result) {
      for (const line of this.wrapLine(this.result.reason, innerWidth)) {
        this.addChild(new Text(this.renderRow(chalk.dim(line), innerWidth, border), BOX_INDENT, 0));
      }
    }

    this.addChild(new Text(`${border('╰')}${border(horizontal)}${border('╯')}`, BOX_INDENT, 0));
  }

  private renderActivityLine(line: string): string {
    const toolName = getActivityToolName(line);
    if (!toolName) return theme.fg('dim', `• ${line}`);

    const rest = line.slice(toolName.length);
    return `${theme.fg('dim', '• ')}${theme.fg('dim', theme.italic(toolName))}${theme.fg('dim', rest)}`;
  }

  private renderHeader(title: string): string {
    if (!this.result) {
      return `${title}  ◌ ${chalk.hex(WAITING_COLOR).bold('evaluating')}`;
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
    const turnInfo = this.maxTurns > 0 ? chalk.hex(MUTED_COLOR)(`(${this.turnsUsed}/${this.maxTurns})`) : '';
    return `${title}  ${decisionIcon} ${decisionText}${turnInfo ? `  ${turnInfo}` : ''}`;
  }

  private renderRow(text: string, width: number, border: (char: string) => string): string {
    const content = this.padLine(text, width);
    return `${border('│')} ${content}${border('│')}`;
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
}

function getActivityToolName(line: string): string | null {
  if (line.startsWith('find files ')) return 'find files';
  const [toolName] = line.split(' ');
  return toolName || null;
}

function getDecisionText(decision: GoalJudgeResult['decision']): string {
  if (decision === 'done') return chalk.hex('#16c858').bold('done');
  if (decision === 'paused') return chalk.hex(PAUSED_COLOR).bold('paused');
  if (decision === 'waiting') return chalk.hex(WAITING_COLOR).bold('waiting');
  return chalk.hex(JUDGE_COLOR).bold('continue');
}
