import { describe, expect, it } from 'vitest';
import { curationQueryLimit, shouldCurate, type CurationTriggerConfig } from '../subconscious/curation-trigger';

const OFF: CurationTriggerConfig = { curationThreshold: false, curationMaxAgeMs: false };
const NOW = Date.parse('2026-08-21T19:00:00.000Z');
const cursorAgedMs = (ms: number) => ({ updatedAt: new Date(NOW - ms) });

describe('shouldCurate', () => {
  it('does not fire when the threshold is not met', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationThreshold: 10 },
        cursor: cursorAgedMs(0),
        newRecordCount: 9,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('fires on threshold when it is met exactly', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationThreshold: 10 },
        cursor: cursorAgedMs(0),
        newRecordCount: 10,
        now: NOW,
      }),
    ).toBe('threshold');
  });

  it('fires on threshold when it is overshot', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationThreshold: 10 },
        cursor: cursorAgedMs(0),
        newRecordCount: 25,
        now: NOW,
      }),
    ).toBe('threshold');
  });

  it('fires on age when the cursor is stale and at least one record is uncurated', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationMaxAgeMs: 60_000 },
        cursor: cursorAgedMs(60_001),
        newRecordCount: 1,
        now: NOW,
      }),
    ).toBe('age');
  });

  it('does NOT fire on age when there is no uncurated work', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationMaxAgeMs: 60_000 },
        cursor: cursorAgedMs(10 * 60_000),
        newRecordCount: 0,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('does not fire on age before the threshold age has elapsed', () => {
    expect(
      shouldCurate({
        config: { ...OFF, curationMaxAgeMs: 60_000 },
        cursor: cursorAgedMs(59_999),
        newRecordCount: 5,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('never fires with both conditions off (the defaults)', () => {
    expect(shouldCurate({ config: OFF, cursor: cursorAgedMs(10 * 60_000), newRecordCount: 500, now: NOW })).toBeNull();
  });

  it('fires on volume when no cursor exists yet', () => {
    expect(
      shouldCurate({
        config: { curationThreshold: 3, curationMaxAgeMs: 60_000 },
        cursor: null,
        newRecordCount: 3,
        now: NOW,
      }),
    ).toBe('threshold');
  });

  it('does not fire on age when no cursor exists, since there is no age baseline', () => {
    expect(
      shouldCurate({
        config: { curationThreshold: 10, curationMaxAgeMs: 1 },
        cursor: null,
        newRecordCount: 9,
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe('curationQueryLimit', () => {
  it('uses the threshold as the query limit when one is configured', () => {
    expect(curationQueryLimit({ ...OFF, curationThreshold: 25 })).toBe(25);
  });

  it('uses a limit of 1 for an age-only configuration', () => {
    expect(curationQueryLimit({ ...OFF, curationMaxAgeMs: 60_000 })).toBe(1);
  });

  it('reports 0 when both conditions are off so the caller can skip the query', () => {
    expect(curationQueryLimit(OFF)).toBe(0);
  });
});
