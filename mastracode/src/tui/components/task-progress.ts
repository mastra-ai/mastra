/**
 * Task progress component for the TUI.
 * Shows a persistent, compact display of the current task list.
 * Hidden when no tasks exist OR when all tasks are completed.
 * Renders between status and editor.
 */
import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import type { TaskItem } from '@mastra/core/harness';
import chalk from 'chalk';
import { fg, bold, getTheme } from '../theme.js';

export class TaskProgressComponent extends Container {
  private tasks: TaskItem[] = [];

  constructor() {
    super();
  }

  /**
   * Replace the entire task list and re-render.
   */
  updateTasks(tasks: TaskItem[]): void {
    this.tasks = tasks;
    this.rebuildDisplay();
  }

  /**
   * Get the current task list (read-only copy).
   */
  getTasks(): TaskItem[] {
    return [...this.tasks];
  }

  private rebuildDisplay(): void {
    this.clear();

    // No tasks = no render (component takes zero vertical space)
    if (this.tasks.length === 0) return;

    // Progress header
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const total = this.tasks.length;

    // Hide the component when all tasks are completed
    if (completed === total) return;
    const headerText = '  ' + bold(fg('accent', 'Tasks')) + fg('dim', ` [${completed}/${total} completed]`);

    this.addChild(new Spacer(1));
    this.addChild(new Text(headerText, 0, 0));

    // Render each task
    for (const task of this.tasks) {
      this.addChild(new Text(this.formatTaskLine(task), 0, 0));
    }
  }

  private formatTaskLine(task: TaskItem): string {
    const indent = '    ';

    switch (task.status) {
      case 'completed': {
        const icon = fg('success', '\u2713');
        const text = chalk.hex(getTheme().success).strikethrough(task.content);
        return `${indent}${icon} ${text}`;
      }
      case 'in_progress': {
        const icon = fg('warning', '\u25B6');
        const text = bold(fg('warning', task.activeForm));
        return `${indent}${icon} ${text}`;
      }
      case 'pending': {
        const icon = fg('dim', '\u25CB');
        const text = fg('dim', task.content);
        return `${indent}${icon} ${text}`;
      }
    }
  }
}
