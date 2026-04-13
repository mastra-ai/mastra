/**
 * Component that renders git diff output with syntax highlighting.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, theme, mastra } from '../theme.js';

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

  // Added lines
  if (line.startsWith('+')) {
    return addedColor(line);
  }

  // Removed lines
  if (line.startsWith('-')) {
    return removedColor(line);
  }

  // Hunk headers
  if (line.startsWith('@@')) {
    // Parse the @@ -start,count +start,count @@ format
    const match = line.match(/^(@@ .+? @@)(.*)/);
    if (match) {
      return hunkHeaderColor(match[1]) + metaColor(match[2] || '');
    }
    return hunkHeaderColor(line);
  }

  // Binary files, rename markers, etc.
  if (
    line.startsWith('diff ') ||
    line.startsWith('index ') ||
    line.startsWith('new file') ||
    line.startsWith('deleted file') ||
    line.startsWith('similarity index') ||
    line.startsWith('rename ')
  ) {
    return metaColor(line);
  }

  return metaColor(line);
}

export class DiffOutputComponent extends Container {
  constructor(command: string, diffOutput: string) {
    super();
    this.addChild(new Spacer(1));

    // Command header
    this.addChild(
      new Text(
        `${theme.fg('success', '✓')} ${theme.bold(theme.fg('muted', '$'))} ${theme.fg('text', command)}`,
        BOX_INDENT,
        0,
      ),
    );

    const output = diffOutput.trimEnd();
    if (output) {
      const lines = output.split('\n');
      for (const line of lines) {
        this.addChild(new Text(`  ${colorizeDiffLine(line)}`, BOX_INDENT, 0));
      }
    }
  }
}
