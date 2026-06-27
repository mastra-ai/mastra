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

  it('shows successful activity over one minute and idle time after one minute', () => {
    const state = {
      lastAgentRunDurationMs: 61 * 60_000,
      lastAgentRunEndedAt: 1_000,
      lastAgentRunEndReason: 'done' as const,
    };

    expect(formatIdleStatusTiming(state, 60_999)).toBe('done in 1hr1m');
    expect(formatIdleStatusTiming(state, 61_000)).toBe('done in 1hr1m · 1m idle');
    expect(formatIdleStatusTiming(state, 181_000)).toBe('done in 1hr1m · 3m idle');
  });

  it('shows successful activity under one minute', () => {
    const state = {
      lastAgentRunDurationMs: 59_000,
      lastAgentRunEndedAt: 1_000,
      lastAgentRunEndReason: 'done' as const,
    };

    expect(formatIdleStatusTiming(state, 60_999)).toBe('done in 59s');
    expect(formatIdleStatusTiming(state, 61_000)).toBe('done in 59s · 1m idle');
  });

  it('shows canceled and errored activity with explicit labels', () => {
    expect(
      formatIdleStatusTiming(
        { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'aborted' },
        2_000,
      ),
    ).toBe('canceled after 1m1s');
    expect(
      formatIdleStatusTiming(
        { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'error' },
        2_000,
      ),
    ).toBe('errored after 1m1s');
  });

  it('can show restored idle time without a known prior work duration', () => {
    expect(formatIdleStatusTiming({ lastAgentRunEndedAt: 0 }, 3 * 60_000)).toBe('3m idle');
  });

  it('omits timing when no timing state is present', () => {
    expect(formatIdleStatusTiming({})).toBe('');
  });
});

describe('IdleCounterComponent', () => {
  it('reserves one stable line and renders work/idle timing above input', () => {
    const component = new IdleCounterComponent();

    expect(component.render(80)).toEqual(['']);

    component.setTimingState(
      { lastAgentRunDurationMs: 61_000, lastAgentRunEndedAt: 1_000, lastAgentRunEndReason: 'done' },
      60_999,
    );
    expect(component.render(80).join('\n')).toContain('done in 1m1s');
    expect(component.render(80).join('\n')).not.toContain('idle');

    component.update(181_000);
    const renderedWithIdle = component.render(80).join('\n');
    expect(renderedWithIdle).toContain('done in 1m1s');
    expect(renderedWithIdle).toContain(' · ');
    expect(renderedWithIdle).toContain('3m idle');

    component.setTimingState(undefined);
    expect(component.render(80)).toEqual(['']);
  });
});
