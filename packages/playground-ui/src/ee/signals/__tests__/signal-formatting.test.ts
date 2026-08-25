import { describe, expect, it } from 'vitest';

import {
  SIGNAL_DESCRIPTIONS,
  SIGNAL_PROCESSING_ORDER,
  formatSignalName,
  formatSnapshotCutoff,
  formatSnapshotDate,
  formatSnapshotWindow,
  getSignalDescription,
  shareSentence,
  themeLabel,
  traceLabel,
} from '../signal-formatting';

describe('SIGNAL_PROCESSING_ORDER', () => {
  it('lists the signals in the order they are produced', () => {
    expect(SIGNAL_PROCESSING_ORDER).toEqual(['goal', 'sentiment', 'behavior', 'outcome']);
  });
});

describe('formatSignalName', () => {
  it.each([
    ['goal', 'Goal'],
    ['sentiment', 'Sentiment'],
    ['behavior', 'Behavior'],
    ['outcome', 'Outcome'],
  ] as const)('capitalizes %s', (signalName, expected) => {
    expect(formatSignalName(signalName)).toBe(expected);
  });
});

describe('getSignalDescription', () => {
  it('describes every signal in plain language', () => {
    expect(SIGNAL_DESCRIPTIONS).toEqual({
      goal: 'What the user wanted from the interaction.',
      sentiment: 'The tone the user expressed during the interaction.',
      behavior: 'What the agent did in response.',
      outcome: 'How the interaction ended.',
    });
  });

  it.each(SIGNAL_PROCESSING_ORDER)('looks up the %s description from an untyped column id', signalName => {
    expect(getSignalDescription(signalName)).toBe(SIGNAL_DESCRIPTIONS[signalName]);
  });

  it('returns undefined for an unknown column id', () => {
    expect(getSignalDescription('latency')).toBeUndefined();
  });

  describe('when the input names an inherited object property', () => {
    it('does not expose it as a signal description', () => {
      expect(getSignalDescription('toString')).toBeUndefined();
      expect(getSignalDescription('__proto__')).toBeUndefined();
    });
  });
});

describe('traceLabel', () => {
  it.each([
    [0, '0 traces'],
    [1, '1 trace'],
    [2, '2 traces'],
  ])('labels %i', (count, expected) => {
    expect(traceLabel(count)).toBe(expected);
  });
});

describe('themeLabel', () => {
  it.each([
    [0, '0 themes'],
    [1, '1 theme'],
    [2, '2 themes'],
  ])('labels %i', (count, expected) => {
    expect(themeLabel(count)).toBe(expected);
  });
});

describe('shareSentence', () => {
  it('extrapolates the stage total from the coverage ratio', () => {
    expect(shareSentence(28, 0.4)).toBe('28 of 70 traces in this snapshot (40%)');
  });

  it('drops the share when coverage is zero', () => {
    expect(shareSentence(28, 0)).toBe('28 traces in this snapshot');
    expect(shareSentence(1, 0)).toBe('1 trace in this snapshot');
  });

  it('drops the share when coverage is negative', () => {
    expect(shareSentence(28, -0.1)).toBe('28 traces in this snapshot');
  });
});

describe('formatSnapshotDate', () => {
  it('renders the UTC calendar date', () => {
    expect(formatSnapshotDate('2026-03-09T14:05:00Z')).toBe('Mar 9, 2026');
  });

  it('returns the raw server value when it is not a date', () => {
    expect(formatSnapshotDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatSnapshotCutoff', () => {
  it('renders the UTC date and 24-hour time', () => {
    expect(formatSnapshotCutoff('2026-03-09T14:05:00Z')).toBe('Mar 9, 2026, 14:05');
  });

  it('returns the raw server value when it is not a date', () => {
    expect(formatSnapshotCutoff('not-a-date')).toBe('not-a-date');
  });
});

describe('formatSnapshotWindow', () => {
  it('collapses a window that starts and ends on the same day', () => {
    expect(formatSnapshotWindow('2026-03-09T01:00:00Z', '2026-03-09T23:00:00Z')).toBe('Mar 9, 2026');
  });

  it('shares the month across a window inside one month', () => {
    expect(formatSnapshotWindow('2026-03-01T00:00:00Z', '2026-03-09T00:00:00Z')).toBe('Mar 1–9, 2026');
  });

  it('shares the year across a window spanning two months', () => {
    expect(formatSnapshotWindow('2026-01-28T00:00:00Z', '2026-03-09T00:00:00Z')).toBe('Jan 28–Mar 9, 2026');
  });

  it('spells out both years across a window spanning a year boundary', () => {
    expect(formatSnapshotWindow('2025-12-28T00:00:00Z', '2026-03-09T00:00:00Z')).toBe('Dec 28, 2025–Mar 9, 2026');
  });

  it('keeps the same day and month apart when the years differ', () => {
    expect(formatSnapshotWindow('2025-03-09T00:00:00Z', '2026-03-09T00:00:00Z')).toBe('Mar 9, 2025–Mar 9, 2026');
  });

  it('returns the raw server values when either end is not a date', () => {
    expect(formatSnapshotWindow('nope', '2026-03-09T00:00:00Z')).toBe('nope–2026-03-09T00:00:00Z');
    expect(formatSnapshotWindow('2026-03-09T00:00:00Z', 'nope')).toBe('2026-03-09T00:00:00Z–nope');
  });
});
