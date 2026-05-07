import process from 'node:process';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JudgeDisplayComponent } from '../judge-display.js';

const WIDTH = 80;

function renderPlain(component: JudgeDisplayComponent): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

describe('JudgeDisplayComponent', () => {
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

  it('labels judge feedback as Goal and keeps the box aligned', () => {
    const component = new JudgeDisplayComponent(
      {
        decision: 'continue',
        reason:
          'This is a long reason that should wrap instead of stretching the box past the right border and making the terminal render jagged.',
      },
      2,
      20,
    );

    const lines = renderPlain(component).filter(line => line.trim().length > 0);
    const widths = lines.map(line => line.length);

    expect(lines.join('\n')).toContain('Goal');
    expect(lines.join('\n')).not.toContain('Judge');
    expect(lines.join('\n')).toContain('(2/20)');
    expect(new Set(widths).size).toBe(1);
  });

  it('renders judge failures as paused instead of continue', () => {
    const component = new JudgeDisplayComponent(
      {
        decision: 'paused',
        reason: 'Judge could not evaluate this turn.',
      },
      1,
      20,
    );

    const rendered = renderPlain(component).join('\n');

    expect(rendered).toContain('paused');
    expect(rendered).not.toContain('continue');
    expect(rendered).toContain('(1/20)');
  });

  it('renders user-blocked goals as waiting instead of continue', () => {
    const component = new JudgeDisplayComponent(
      {
        decision: 'waiting',
        reason: 'The assistant is correctly waiting for feedback before continuing.',
      },
      1,
      20,
    );

    const rendered = renderPlain(component).join('\n');

    expect(rendered).toContain('waiting');
    expect(rendered).not.toContain('continue');
    expect(rendered).toContain('(1/20)');
  });
});
