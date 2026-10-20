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
  it('renders nothing when no tasks are visible (the idle row is the gap above the input)', () => {
    const component = new TaskProgressComponent();

    expect(component.render(120)).toEqual([]);
  });

  it('renders an item-aware summary when tasks are active', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([
      { id: 'one', content: 'Inspect task progress', activeForm: 'Inspecting task progress', status: 'completed' },
      {
        id: 'two',
        content: 'Implement compact tasks',
        activeForm: 'Implementing compact tasks',
        status: 'in_progress',
      },
      { id: 'three', content: 'Verify compact tasks', activeForm: 'Verifying compact tasks', status: 'pending' },
    ]);

    const lines = component.render(120).map(line => stripAnsi(line));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('');
    expect(lines[1]).toContain('1/3');
    expect(lines[1]).not.toContain('Tasks');
    expect(lines[1]).not.toContain('[1/3]');
    expect(lines[1]).toContain('▶ Implementing compact tasks');
    expect(lines[1]).toContain('○ Verify compact tasks');
    expect(lines[1]).toContain('✓ Inspect task progress');
    expect(lines[1].indexOf('Inspect task progress')).toBeLessThan(lines[1].indexOf('Implementing compact tasks'));
    expect(lines[1].indexOf('Implementing compact tasks')).toBeLessThan(lines[1].indexOf('Verify compact tasks'));
  });

  it('wraps compact summaries between tasks without wrapping individual task items', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([
      { id: 'one', content: 'Inspect task progress', activeForm: 'Inspecting task progress', status: 'completed' },
      {
        id: 'two',
        content: 'Implement item aware compact task summary wrapping',
        activeForm: 'Implementing item aware compact task summary wrapping',
        status: 'in_progress',
      },
      {
        id: 'three',
        content: 'Verify compact task wrapping',
        activeForm: 'Verifying compact task wrapping',
        status: 'pending',
      },
    ]);

    const lines = component.render(80).map(line => stripAnsi(line).trimEnd());

    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('1/3  ✓ Inspect task progress');
    expect(lines[2]).toBe('       ▶ Implementing item aware compact task summary wrapping');
    expect(lines[3]).toBe('       ○ Verify compact task wrapping');
  });

  it('wraps compact summaries using terminal display width for wide characters', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([
      { id: 'one', content: '界'.repeat(35), activeForm: 'Doing wide work', status: 'pending' },
      { id: 'two', content: 'Done', activeForm: 'Doing', status: 'pending' },
    ]);

    const lines = component.render(80).map(line => stripAnsi(line).trimEnd());

    expect(lines).toHaveLength(3);
    expect(visibleWidth(lines[1]!)).toBeLessThanOrEqual(80);
    expect(lines[2]).toBe('       ○ Done');
  });

  it('renders nothing again after all tasks complete', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([{ id: 'one', content: 'Done', activeForm: 'Doing', status: 'completed' }]);

    expect(component.render(120)).toEqual([]);
  });
});
