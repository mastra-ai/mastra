/**
 * JudgeDisplayComponent — renders the goal judge's decision inline in the chat.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

import type { GoalJudgeResult } from '../goal-manager.js';
import { BOX_INDENT, getTermWidth, mastraBrand } from '../theme.js';

const JUDGE_COLOR = mastraBrand.blue;
const MUTED_COLOR = '#8a8a8a';
const PAUSED_COLOR = '#f5a524';
const WAITING_COLOR = '#8a8a8a';

export class JudgeDisplayComponent extends Container {
  constructor(result: GoalJudgeResult, turnsUsed: number, maxTurns: number) {
    super();

    const border = (char: string) => chalk.hex(JUDGE_COLOR)(char);
    const title = chalk.hex(JUDGE_COLOR).bold('Goal');
    const termWidth = getTermWidth();
    const innerWidth = Math.max(20, termWidth - BOX_INDENT * 2 - 4);
    const horizontal = '─'.repeat(innerWidth + 1);

    const decisionIcon =
      result.decision === 'done' ? '●' : result.decision === 'paused' ? '!' : result.decision === 'waiting' ? '◌' : '○';
    const decisionText = getDecisionText(result.decision);
    const turnInfo = chalk.hex(MUTED_COLOR)(`(${turnsUsed}/${maxTurns})`);

    this.addChild(new Spacer(1));
    this.addChild(new Text(`${border('╭')}${border(horizontal)}${border('╮')}`, BOX_INDENT, 0));
    this.addChild(
      new Text(
        this.renderRow(`${title}  ${decisionIcon} ${decisionText}  ${turnInfo}`, innerWidth, border),
        BOX_INDENT,
        0,
      ),
    );
    for (const line of this.wrapLine(result.reason, innerWidth)) {
      this.addChild(new Text(this.renderRow(chalk.dim(line), innerWidth, border), BOX_INDENT, 0));
    }
    this.addChild(new Text(`${border('╰')}${border(horizontal)}${border('╯')}`, BOX_INDENT, 0));
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

function getDecisionText(decision: GoalJudgeResult['decision']): string {
  if (decision === 'done') return chalk.hex('#16c858').bold('done');
  if (decision === 'paused') return chalk.hex(PAUSED_COLOR).bold('paused');
  if (decision === 'waiting') return chalk.hex(WAITING_COLOR).bold('waiting');
  return chalk.hex(JUDGE_COLOR).bold('continue');
}
