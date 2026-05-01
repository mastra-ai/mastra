/**
 * JudgeDisplayComponent — renders the goal judge's decision inline in the chat
 * with a blue bordered box labeled "Judge".
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

import type { GoalJudgeResult } from '../goal-manager.js';
import { BOX_INDENT, getTermWidth, mastraBrand } from '../theme.js';

const JUDGE_COLOR = mastraBrand.blue;

export class JudgeDisplayComponent extends Container {
  constructor(result: GoalJudgeResult, turnsUsed: number, maxTurns: number) {
    super();

    const border = (char: string) => chalk.hex(JUDGE_COLOR)(char);
    const title = chalk.hex(JUDGE_COLOR).bold('Judge');
    const termWidth = getTermWidth();
    const innerWidth = Math.max(20, termWidth - BOX_INDENT * 2 - 4);
    const horizontal = '─'.repeat(innerWidth + 1);

    const decisionIcon = result.decision === 'done' ? '●' : '○';
    const decisionText =
      result.decision === 'done' ? chalk.hex('#16c858').bold('done') : chalk.hex(JUDGE_COLOR).bold('continue');
    const turnInfo = chalk.dim(`(${turnsUsed}/${maxTurns})`);
    const reasonText = chalk.dim(result.reason);

    this.addChild(new Spacer(1));
    this.addChild(new Text(`${border('╭')}${border(horizontal)}${border('╮')}`, BOX_INDENT, 0));
    this.addChild(
      new Text(
        this.renderRow(`${title}  ${decisionIcon} ${decisionText}  ${turnInfo}`, innerWidth, border),
        BOX_INDENT,
        0,
      ),
    );
    this.addChild(new Text(this.renderRow(reasonText, innerWidth, border), BOX_INDENT, 0));
    this.addChild(new Text(`${border('╰')}${border(horizontal)}${border('╯')}`, BOX_INDENT, 0));
  }

  private renderRow(text: string, width: number, border: (char: string) => string): string {
    const content = this.padLine(text, width);
    return `${border('│')} ${content}${border('│')}`;
  }

  private padLine(text: string, width: number): string {
    const visibleLength = stripAnsi(text).length;
    if (visibleLength >= width) {
      return text;
    }
    return text + ' '.repeat(width - visibleLength);
  }
}
