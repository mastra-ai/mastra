/**
 * Task progress component for the TUI.
 * Shows a persistent, compact display of the current task list.
 * Hidden when no tasks exist OR when all tasks are completed.
 * Renders between status and editor.
 */
import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import type { TaskItemInput } from '@mastra/core/harness';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { getTermWidth, theme } from '../theme.js';
import { truncateAnsi } from './ansi.js';

export class TaskProgressComponent extends Container {
  private tasks: TaskItemInput[] = [];

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
