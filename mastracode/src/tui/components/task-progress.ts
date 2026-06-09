/**
 * Task progress component for the TUI.
 * Shows a persistent, compact display of the current task list.
 * Hidden when no tasks exist OR when all tasks are completed.
 * Renders between status and editor.
 */
import { Container, Text, Spacer, visibleWidth } from '@mariozechner/pi-tui';
import type { TaskItemInput } from '@mastra/core/harness';
import chalk from 'chalk';
import { getTermWidth, theme } from '../theme.js';
import { truncateAnsi } from './ansi.js';

function padAnsiToWidth(text: string, targetWidth: number): string {
  const w = visibleWidth(text);
  if (w >= targetWidth) return truncateAnsi(text, targetWidth);
  return text + ' '.repeat(targetWidth - w);
}

export class TaskProgressComponent extends Container {
  private tasks: TaskItemInput[] = [];
  private quietMode = false;

  constructor() {
    super();
    this.rebuildDisplay();
  }

  /**
   * Replace the entire task list and re-render.
   */
  updateTasks(tasks: TaskItemInput[]): void {
    this.tasks = tasks;
    this.rebuildDisplay();
  }

  setQuietMode(enabled: boolean): void {
    this.quietMode = enabled;
    this.rebuildDisplay();
  }

  /**
   * Get the current task list (read-only copy).
   */
  getTasks(): TaskItemInput[] {
    return [...this.tasks];
  }

  private rebuildDisplay(): void {
    this.clear();

    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const total = this.tasks.length;
    const hasVisibleTasks = total > 0 && completed !== total;

    if (!hasVisibleTasks) {
      this.addChild(new Spacer(1));
      return;
    }

    this.addChild(new Spacer(1));

    if (this.quietMode) {
      for (const line of this.formatQuietTaskLines(completed, total)) {
        this.addChild(new Text(line, 0, 0));
      }
      return;
    }

    // Progress header
    const headerText =
      '  ' + theme.bold(theme.fg('accent', 'Tasks')) + theme.fg('dim', ` [${completed}/${total} completed]`);

    this.addChild(new Text(headerText, 0, 0));

    // Render each task
    for (const task of this.tasks) {
      this.addChild(new Text(this.formatTaskLine(task), 0, 0));
    }
  }

  private formatQuietTaskLines(completed: number, total: number): string[] {
    const prefix = '  ' + theme.fg('muted', `${completed}/${total}`);
    const prefixWidth = visibleWidth(prefix);
    const continuationPrefix = ' '.repeat(prefixWidth);
    const maxWidth = Math.max(20, getTermWidth());
    const sep = '  ';
    const sepWidth = sep.length;

    const items = this.tasks.map(task => this.formatQuietTaskItem(task));
    const itemWidths = items.map(item => visibleWidth(item));
    const available = maxWidth - prefixWidth - sepWidth;

    if (available < 10 || items.length === 0) {
      return [prefix + (items.length > 0 ? sep + truncateAnsi(items.join(sep), available) : '')];
    }

    // Check if all items fit on a single line without padding
    const totalUnpadded = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? sepWidth : 0), 0);
    if (totalUnpadded <= available) {
      return [prefix + sep + items.join(sep)];
    }

    // Grid layout: pad items to uniform column width for vertical alignment
    const maxItemWidth = Math.max(...itemWidths);

    let colWidth: number;
    let numCols = Math.max(1, Math.floor((available + sepWidth) / (maxItemWidth + sepWidth)));

    if (numCols >= 2) {
      colWidth = maxItemWidth;
    } else {
      const twoColWidth = Math.floor((available - sepWidth) / 2);
      if (twoColWidth >= 15) {
        colWidth = twoColWidth;
        numCols = 2;
      } else {
        colWidth = available;
        numCols = 1;
      }
    }

    const rows: string[][] = [];
    let currentRow: string[] = [];
    for (const item of items) {
      if (currentRow.length >= numCols) {
        rows.push(currentRow);
        currentRow = [];
      }
      currentRow.push(item);
    }
    if (currentRow.length > 0) rows.push(currentRow);

    const lines: string[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]!;
      const linePrefix = r === 0 ? prefix : continuationPrefix;
      const formattedCells = row.map((item, i) => {
        if (i < row.length - 1 || r < rows.length - 1) {
          return padAnsiToWidth(item, colWidth);
        }
        return truncateAnsi(item, colWidth);
      });
      lines.push(linePrefix + sep + formattedCells.join(sep));
    }

    return lines;
  }

  private formatQuietTaskItem(task: TaskItemInput): string {
    switch (task.status) {
      case 'completed': {
        const icon = theme.fg('dim', '✓');
        const text = chalk.strikethrough(theme.fg('dim', task.content));
        return `${icon} ${text}`;
      }
      case 'in_progress': {
        const icon = theme.fg('warning', '▶');
        const text = theme.bold(theme.fg('warning', task.activeForm));
        return `${icon} ${text}`;
      }
      case 'pending': {
        const icon = theme.fg('dim', '○');
        const text = theme.fg('muted', task.content);
        return `${icon} ${text}`;
      }
    }
  }

  private formatTaskLine(task: TaskItemInput): string {
    const indent = '    ';

    switch (task.status) {
      case 'completed': {
        const icon = theme.fg('success', '\u2713');
        const text = chalk.hex(theme.getTheme().success).strikethrough(task.content);
        return `${indent}${icon} ${text}`;
      }
      case 'in_progress': {
        const icon = theme.fg('warning', '\u25B6');
        const text = theme.bold(theme.fg('warning', task.activeForm));
        return `${indent}${icon} ${text}`;
      }
      case 'pending': {
        const icon = theme.fg('dim', '\u25CB');
        const text = theme.fg('dim', task.content);
        return `${indent}${icon} ${text}`;
      }
    }
  }
}
