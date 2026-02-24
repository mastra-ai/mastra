/**
 * Component that renders git diff output with syntax highlighting.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { fg, bold, mastra } from '../theme.js';

// const removedColor = chalk.hex("#dc6868") // soft red
const addedColor = chalk.hex('#5cb85c'); // soft green
const hunkHeaderColor = chalk.hex('#61afef'); // cyan-blue
const fileHeaderColor = chalk.bold.hex('#c678dd'); // bold purple
const removedColor = chalk.hex(mastra.red);
// const addedColor = chalk.hex(mastra.green)
// const hunkHeaderColor = chalk.hex(mastra.blue)
// const fileHeaderColor = chalk.bold.hex(mastra.purple)
const metaColor = chalk.hex(mastra.mainGray);

function colorizeDiffLine(line: string): string {
  // Unified diff headers
  if (line.startsWith('+++') || line.startsWith('---')) {
    return fileHeaderColor(line);
  }
  if (line.startsWith('diff ')) {
    return fileHeaderColor(line);
  }
  if (line.startsWith('@@')) {
    return hunkHeaderColor(line);
  }
  if (line.startsWith('+')) {
    return addedColor(line);
  }
  if (line.startsWith('-')) {
    return removedColor(line);
  }
  if (
    line.startsWith('index ') ||
    line.startsWith('new file') ||
    line.startsWith('deleted file') ||
    line.startsWith('similarity') ||
    line.startsWith('rename')
  ) {
    return metaColor(line);
  }
  // --stat lines: " file | 5 +++--" or summary "2 files changed, ..."
  const statMatch = line.match(/^(.+\|.+?)(\++)([-]*)$/);
  if (statMatch) {
    return statMatch[1] + addedColor(statMatch[2]) + removedColor(statMatch[3]);
  }
  if (/^\s*\d+ files? changed/.test(line)) {
    return line
      .replace(/(\d+ insertions?\(\+\))/, addedColor('$1'))
      .replace(/(\d+ deletions?\(-\))/, removedColor('$1'));
  }
  return line;
}

export class DiffOutputComponent extends Container {
  constructor(command: string, diffOutput: string) {
    super();
    this.addChild(new Spacer(1));

    // Command header
    this.addChild(new Text(`${fg('success', '✓')} ${bold(fg('muted', '$'))} ${fg('text', command)}`, 1, 0));

    const output = diffOutput.trimEnd();
    if (output) {
      const lines = output.split('\n');
      for (const line of lines) {
        this.addChild(new Text(`  ${colorizeDiffLine(line)}`, 0, 0));
      }
    }
  }
}
