import process from 'node:process';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SystemReminderComponent } from '../system-reminder.js';

const WIDTH = 80;

function renderPlain(component: SystemReminderComponent): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

function nonEmpty(lines: string[]): string[] {
  return lines.filter(line => line.trim().length > 0);
}

describe('SystemReminderComponent', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: WIDTH,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  it('renders a single loaded path line for dynamic instruction reminders', () => {
    const comp = new SystemReminderComponent({
      message: 'Use the nested instructions when replying.',
      reminderType: 'dynamic-agents-md',
      path: `${process.cwd()}/packages/core/AGENTS.md`,
    });

    const lines = nonEmpty(renderPlain(comp)).map(line => line.trimEnd());

    expect(lines).toEqual(['  loaded packages/core/AGENTS.md']);
  });

  it('does not render generic dynamic instruction reminder text when a path is available', () => {
    const comp = new SystemReminderComponent({
      message:
        'When using guidance from a discovered instruction file, mention the instruction file you used and how it affected your response.',
      reminderType: 'dynamic-agents-md',
      path: `${process.cwd()}/packages/core/AGENTS.md`,
    });

    const rendered = renderPlain(comp).join('\n');

    expect(rendered).toContain('loaded packages/core/AGENTS.md');
    expect(rendered).not.toContain('When using guidance from a discovered instruction file');
    expect(rendered).not.toContain('Loading instruction file contents');
  });

  it('renders initial goal metadata inline in the title', () => {
    const comp = new SystemReminderComponent({
      message: 'Finish the implementation.',
      reminderType: 'goal',
      goalMaxTurns: 20,
      judgeModelId: 'openai/gpt-5.5',
    });

    const lines = nonEmpty(renderPlain(comp));

    expect(lines.some(line => line.includes('Goal (20 max attempts, judge: openai/gpt-5.5)'))).toBe(true);
    expect(lines.some(line => line.includes('Finish the implementation.'))).toBe(true);
    expect(lines.some(line => line.trim() === 'Goal set (20 max attempts, judge: openai/gpt-5.5)')).toBe(false);
    expect(lines.some(line => line.includes('System Reminder'))).toBe(false);
  });

  it('renders Goal title for goal judge reminders', () => {
    const comp = new SystemReminderComponent({
      message: '[Goal attempt 1/20] Keep working.',
      reminderType: 'goal-judge',
    });

    const lines = nonEmpty(renderPlain(comp));

    expect(lines.some(line => line.includes('Goal'))).toBe(true);
    expect(lines.some(line => line.includes('System Reminder'))).toBe(false);
  });

  it('renders the original title for regular system reminders', () => {
    const comp = new SystemReminderComponent({
      message: 'The user has approved the plan, begin executing.',
    });

    const lines = nonEmpty(renderPlain(comp));

    expect(lines.some(line => line.includes('System Reminder'))).toBe(true);
    expect(lines.some(line => line.includes('⚡ System Reminder'))).toBe(false);
    expect(lines.some(line => line.includes('Loaded AGENTS.md'))).toBe(false);
  });

  it('renders cwd-relative loaded instruction paths when possible', () => {
    const comp = new SystemReminderComponent({
      message: 'Use the nested instructions when replying.',
      path: `${process.cwd()}/src/agents/nested/AGENTS.md`,
    });

    const lines = nonEmpty(renderPlain(comp)).map(line => line.trimEnd());

    expect(lines).toEqual(['  loaded src/agents/nested/AGENTS.md']);
  });

  it('renders a left-bar card with every row padded to the terminal width', () => {
    const comp = new SystemReminderComponent({
      message: 'Use the nested instructions when replying.',
    });

    const lines = nonEmpty(renderPlain(comp));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^▎ System Reminder\s+$/);
    expect(lines[1]).toMatch(/^▎ Use the nested instructions when replying\.\s+$/);
    for (const line of lines) {
      expect(line).toHaveLength(WIDTH);
    }
    expect(lines.join('\n')).not.toMatch(/[╭╮╰╯│]/);
  });

  it('collapses long content by default', () => {
    const comp = new SystemReminderComponent({
      message: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6'].join('\n'),
    });

    const lines = nonEmpty(renderPlain(comp));

    expect(lines.some(line => line.includes('line 1'))).toBe(true);
    expect(lines.some(line => line.includes('line 4'))).toBe(true);
    expect(lines.some(line => line.includes('line 5'))).toBe(true);
    expect(lines.some(line => line.includes('line 6'))).toBe(true);
    expect(lines.some(line => line.includes('collapsed by default'))).toBe(false);
  });

  it('shows full content after expansion', () => {
    const comp = new SystemReminderComponent({
      message: [
        'line 1',
        'line 2',
        'line 3',
        'line 4',
        'line 5',
        'line 6',
        'line 7',
        'line 8',
        'line 9',
        'line 10',
        'line 11',
        'line 12',
      ].join('\n'),
    });

    comp.setExpanded(true);
    const lines = nonEmpty(renderPlain(comp));

    expect(lines.some(line => line.includes('line 11'))).toBe(true);
    expect(lines.some(line => line.includes('line 12'))).toBe(true);
    expect(lines.some(line => line.includes('collapsed by default'))).toBe(false);
  });

  it('collapses after ten lines by default', () => {
    const comp = new SystemReminderComponent({
      message: Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n'),
    });

    const lines = nonEmpty(renderPlain(comp));

    expect(lines.some(line => line.includes('line 10'))).toBe(true);
    expect(lines.some(line => line.includes('line 11'))).toBe(false);
    expect(lines.some(line => line.includes('line 12'))).toBe(false);
    expect(lines.some(line => line.includes('ctrl+e to expand'))).toBe(true);
    expect(lines.some(line => line.includes('collapsed by default'))).toBe(false);
  });

  it('reports expansion state', () => {
    const comp = new SystemReminderComponent({ message: 'line 1' });

    expect(comp.isExpanded()).toBe(false);
    comp.setExpanded(true);
    expect(comp.isExpanded()).toBe(true);
    comp.toggleExpanded();
    expect(comp.isExpanded()).toBe(false);
  });
});
