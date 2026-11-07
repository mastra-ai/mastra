import { describe, expect, it } from 'vitest';
import { IdleCounterComponent, formatIdleStatusTiming } from '../idle-counter.js';

describe('formatIdleStatusTiming', () => {
  it('does not show active elapsed time while the agent is running', () => {
    expect(formatIdleStatusTiming({ lastAgentRunDurationMs: undefined, lastAgentRunEndedAt: undefined }, 2_000)).toBe(
      '',
    );
  });

  it('shows only idle time after one minute', () => {
    const state = {
      lastAgentRunDurationMs: 61 * 60_000,
      lastAgentRunEndedAt: 1_000,
      lastAgentRunEndReason: 'done' as const,
    };

    expect(formatIdleStatusTiming(state, 60_999)).toBe('');
    expect(formatIdleStatusTiming(state, 61_000)).toBe('1m idle');
    expect(formatIdleStatusTiming(state, 181_000)).toBe('3m idle');
  });

  it('does not show completed activity labels above input', () => {
    expect(
      formatIdleStatusTiming(
        { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'aborted' },
        2_000,
      ),
    ).toBe('');
    expect(
      formatIdleStatusTiming(
        { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'error' },
        61_000,
      ),
    ).toBe('1m idle');
  });

  it('can show restored idle time without a known prior work duration', () => {
    expect(formatIdleStatusTiming({ lastAgentRunEndedAt: 0 }, 3 * 60_000)).toBe('3m idle');
  });

  it('omits timing when no timing state is present', () => {
    expect(formatIdleStatusTiming({})).toBe('');
  });
});

describe('IdleCounterComponent', () => {
  const plain = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, '').trim());

  it('always renders a gap plus one row so the prompt never shifts', () => {
    const component = new IdleCounterComponent();
    expect(component.render(80)).toEqual(['', '']);

    component.setTimingState(
      { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'done' },
      60_999,
    );
    expect(component.render(80)).toEqual(['', '']);

    component.update(181_000);
    expect(plain(component.render(80))).toEqual(['', '3m idle']);

    component.setActivity(' • working  3s · esc to interrupt');
    expect(plain(component.render(80))).toEqual(['', '• working  3s · esc to interrupt']);

    component.setActivity('');
    component.setTimingState(undefined);
    expect(component.render(80)).toEqual(['', '']);
  });

  it('keeps the Working row to a single row on narrow terminals', () => {
    const component = new IdleCounterComponent();
    component.setActivity(` • working  ${'x'.repeat(100)}`);
    expect(component.render(20)).toHaveLength(2);
  });
});
