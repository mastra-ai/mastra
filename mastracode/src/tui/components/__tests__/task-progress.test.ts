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

  it('reserves one blank line again after all tasks complete', () => {
    const component = new TaskProgressComponent();

    component.updateTasks([{ id: 'one', content: 'Done', activeForm: 'Doing', status: 'completed' }]);

    expect(component.render(120)).toEqual(['']);
  });
});
