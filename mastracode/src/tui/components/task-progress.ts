/**
 * Task progress component for the TUI.
 * Shows a persistent, compact display of the current task list.
 * Hidden when no tasks exist OR when all tasks are completed.
 * Renders between status and editor.
 */
import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import type { TaskItemInput } from '@mastra/core/harness';
import chalk from 'chalk';
import { theme } from '../theme.js';

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
      this.addChild(new Text(this.formatQuietTaskLine(completed, total), 0, 0));
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

  private formatQuietTaskLine(completed: number, total: number): string {
    const prefix = '  ' + theme.fg('dim', `${completed}/${total}`);
    const parts = [prefix];

    for (const task of this.tasks) {
      switch (task.status) {
        case 'completed': {
          const icon = theme.fg('success', '✓');
          const text = chalk.hex(theme.getTheme().success).strikethrough(task.content);
          parts.push(`${icon} ${text}`);
          break;
        }
        case 'in_progress': {
          const icon = theme.fg('warning', '▶');
          const text = theme.bold(theme.fg('warning', task.activeForm));
          parts.push(`${icon} ${text}`);
          break;
        }
        case 'pending': {
          const icon = theme.fg('dim', '○');
          const text = theme.fg('dim', task.content);
          parts.push(`${icon} ${text}`);
          break;
        }
      }
    }

    return parts.join('  ');
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
