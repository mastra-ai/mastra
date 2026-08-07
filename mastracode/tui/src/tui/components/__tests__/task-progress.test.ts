import { visibleWidth } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

vi.mock('chalk', () => {
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        if (['hex', 'bgHex', 'rgb', 'bgRgb'].includes(prop as string)) return () => makeChain();
        return makeChain();
      },
    });

  return { default: makeChain() };
});

vi.mock('../../theme.js', () => ({
  getTermWidth: () => 80,
  theme: {
    bold: (value: string) => value,
    fg: (_tone: string, value: string) => value,
    getTheme: () => ({ success: '#22c55e' }),
  },
}));

import { TaskProgressComponent } from '../task-progress.js';

describe('TaskProgressComponent', () => {
  it('reserves one blank line above the input when no tasks are visible', () => {
    const component = new TaskProgressComponent();

    expect(component.render(120)).toEqual(['']);
  });

  it('keeps current task rendering when tasks are active', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([
      { id: 'one', content: 'Do the thing', activeForm: 'Doing the thing', status: 'in_progress' },
      { id: 'two', content: 'Do the next thing', activeForm: 'Doing the next thing', status: 'pending' },
    ]);

    const lines = component.render(120).map(line => stripAnsi(line));

    expect(lines[0]).toBe('');
    expect(lines[1]).toContain('Tasks [0/2 completed]');
    expect(lines[2]).toContain('Doing the thing');
    expect(lines[3]).toContain('Do the next thing');
  });

  it('renders an item-aware summary when quiet mode is active', () => {
    const component = new TaskProgressComponent();
    component.setQuietMode(true);

    component.updateTasks([
      { id: 'one', content: 'Inspect task progress', activeForm: 'Inspecting task progress', status: 'completed' },
      { id: 'two', content: 'Implement quiet tasks', activeForm: 'Implementing quiet tasks', status: 'in_progress' },
      { id: 'three', content: 'Verify quiet tasks', activeForm: 'Verifying quiet tasks', status: 'pending' },
    ]);

    const lines = component.render(120).map(line => stripAnsi(line));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('');
    expect(lines[1]).toContain('1/3');
    expect(lines[1]).not.toContain('Tasks');
    expect(lines[1]).not.toContain('[1/3]');
    expect(lines[1]).toContain('▶ Implementing quiet tasks');
    expect(lines[1]).toContain('○ Verify quiet tasks');
    expect(lines[1]).toContain('✓ Inspect task progress');
    expect(lines[1].indexOf('Inspect task progress')).toBeLessThan(lines[1].indexOf('Implementing quiet tasks'));
    expect(lines[1].indexOf('Implementing quiet tasks')).toBeLessThan(lines[1].indexOf('Verify quiet tasks'));
  });

  it('wraps quiet summaries between tasks without wrapping individual task items', () => {
    const component = new TaskProgressComponent();
    component.setQuietMode(true);

    component.updateTasks([
      { id: 'one', content: 'Inspect task progress', activeForm: 'Inspecting task progress', status: 'completed' },
      {
        id: 'two',
        content: 'Implement item aware quiet task summary wrapping',
        activeForm: 'Implementing item aware quiet task summary wrapping',
        status: 'in_progress',
      },
      {
        id: 'three',
        content: 'Verify quiet task wrapping',
        activeForm: 'Verifying quiet task wrapping',
        status: 'pending',
      },
    ]);

    const lines = component.render(80).map(line => stripAnsi(line).trimEnd());

    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('1/3  ✓ Inspect task progress');
    expect(lines[2]).toBe('       ▶ Implementing item aware quiet task summary wrapping');
    expect(lines[3]).toBe('       ○ Verify quiet task wrapping');
  });

  it('wraps quiet summaries using terminal display width for wide characters', () => {
    const component = new TaskProgressComponent();
    component.setQuietMode(true);

    component.updateTasks([
      { id: 'one', content: '界'.repeat(35), activeForm: 'Doing wide work', status: 'pending' },
      { id: 'two', content: 'Done', activeForm: 'Doing', status: 'pending' },
    ]);

    const lines = component.render(80).map(line => stripAnsi(line).trimEnd());

    expect(lines).toHaveLength(3);
    expect(visibleWidth(lines[1]!)).toBeLessThanOrEqual(80);
    expect(lines[2]).toBe('       ○ Done');
  });

  it('updates between expanded and quiet task rendering', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([
      { id: 'one', content: 'Do the thing', activeForm: 'Doing the thing', status: 'in_progress' },
      { id: 'two', content: 'Do the next thing', activeForm: 'Doing the next thing', status: 'pending' },
    ]);

    expect(component.render(120).map(line => stripAnsi(line))).toHaveLength(4);

    component.setQuietMode(true);
    const quietLines = component.render(120).map(line => stripAnsi(line));

    expect(quietLines).toHaveLength(2);
    expect(quietLines[1]).toContain('Doing the thing');
    expect(quietLines[1]).toContain('Do the next thing');
  });

  it('reserves one blank line again after all tasks complete', () => {
    const component = new TaskProgressComponent();
    component.setQuietMode(true);

    component.updateTasks([{ id: 'one', content: 'Done', activeForm: 'Doing', status: 'completed' }]);

    expect(component.render(120)).toEqual(['']);
  });
});
