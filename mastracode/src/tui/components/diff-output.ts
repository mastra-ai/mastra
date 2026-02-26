/**
 * Component that renders git diff output with syntax highlighting.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { theme, mastra } from '../theme.js';

function colorizeDiffLine(line: string): string {
  const t = theme.getTheme();
  const addedColor = chalk.hex(t.success);
  const hunkHeaderColor = chalk.hex(t.toolBorderPending);
  const fileHeaderColor = chalk.bold.hex(t.accent);
  const removedColor = chalk.hex(mastra.red);
  const metaColor = chalk.hex(mastra.mainGray);

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
  const statMatch = line.match(/^(.+\|.+?)(\++)([- ]*)$/);
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
    this.addChild(
      new Text(`${theme.fg('success', '✓')} ${theme.bold(theme.fg('muted', '$'))} ${theme.fg('text', command)}`, 1, 0),
    );

    const output = diffOutput.trimEnd();
    if (output) {
      const lines = output.split('\n');
      for (const line of lines) {
        this.addChild(new Text(`  ${colorizeDiffLine(line)}`, 0, 0));
      }
    }
  }
}
