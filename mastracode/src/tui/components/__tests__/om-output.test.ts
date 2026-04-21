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
  BOX_INDENT: 0,
  getTermWidth: () => 80,
  mastra: {
    orange: '#f59e0b',
    red: '#ef4444',
    green: '#22c55e',
    specialGray: '#9ca3af',
    mainGray: '#6b7280',
  },
}));

import { OMOutputComponent } from '../om-output.js';

describe('OMOutputComponent activation rendering', () => {
  const conciseHistory = Array.from({ length: 14 }, (_, index) => `line ${index + 1}`).join('\n');

  it('renders activation concise history collapsed by default', () => {
    const component = new OMOutputComponent({
      type: 'activation',
      observations: conciseHistory,
    });

    const output = stripAnsi(component.render(80).join('\n'));

    expect(output).toContain('line 1');
    expect(output).toContain('line 14');
    expect(output).toContain('... 14 lines total (ctrl+e to expand)');
    expect(output).toContain('Activated concise history');
    expect(output).not.toContain('line 8');
  });

  it('renders the full concise history when expanded', () => {
    const component = new OMOutputComponent({
      type: 'activation',
      observations: conciseHistory,
    });

    component.toggleExpanded();

    const output = stripAnsi(component.render(80).join('\n'));

    expect(output).toContain('line 1');
    expect(output).toContain('line 8');
    expect(output).toContain('line 14');
    expect(output).not.toContain('ctrl+e to expand');
  });
});
