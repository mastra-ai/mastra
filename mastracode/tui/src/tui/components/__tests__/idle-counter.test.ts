import { describe, expect, it } from 'vitest';
import { IdleCounterComponent, formatIdleStatusTiming, formatStatusDuration } from '../idle-counter.js';

describe('formatStatusDuration', () => {
  it('formats active durations with seconds below an hour', () => {
    expect(formatStatusDuration(1_000, { includeSeconds: true })).toBe('1s');
    expect(formatStatusDuration(59_000, { includeSeconds: true })).toBe('59s');
    expect(formatStatusDuration(61_000, { includeSeconds: true })).toBe('1m1s');
    expect(formatStatusDuration(59 * 60_000 + 59_000, { includeSeconds: true })).toBe('59m59s');
  });

  it('formats hour and day durations without seconds', () => {
    expect(formatStatusDuration(60 * 60_000, { includeSeconds: true })).toBe('1hr');
    expect(formatStatusDuration(61 * 60_000 + 1_000, { includeSeconds: true })).toBe('1hr1m');
    expect(formatStatusDuration(24 * 60 * 60_000 + 61 * 60_000, { includeSeconds: true })).toBe('1d1hr1m');
  });

  it('floors idle durations to compact whole minutes', () => {
    expect(formatStatusDuration(3 * 60_000 + 59_000)).toBe('3m');
    expect(formatStatusDuration(61 * 60_000)).toBe('1hr1m');
    expect(formatStatusDuration(24 * 60 * 60_000 + 61 * 60_000)).toBe('1d1hr1m');
  });
});

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
  it('reserves one stable line and renders only idle timing above input', () => {
    const component = new IdleCounterComponent();

    expect(component.render(80)).toEqual(['']);

    component.setTimingState(
      { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'done' },
      60_999,
    );
    expect(component.render(80)).toEqual(['']);

    component.update(181_000);
    const renderedWithIdle = component.render(80).join('\n');
    expect(renderedWithIdle).not.toContain('done in');
    expect(renderedWithIdle).not.toContain(' · ');
    expect(renderedWithIdle).toContain('3m idle');

    component.setTimingState(undefined);
    expect(component.render(80)).toEqual(['']);
  });
});
