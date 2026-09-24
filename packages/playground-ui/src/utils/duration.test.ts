import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationPrecise, formatElapsed } from './duration';

describe('formatDuration', () => {
  describe('when the duration is valid', () => {
    it('picks the most readable unit', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(123)).toBe('123ms');
      expect(formatDuration(1234)).toBe('1.23s');
      expect(formatDuration(65_000)).toBe('1m 5s');
      expect(formatDuration(7_380_000)).toBe('2h 3m');
      expect(formatDuration(100_800_000)).toBe('1d 4h');
    });

    it('drops an empty remainder', () => {
      expect(formatDuration(120_000)).toBe('2m');
    });
  });

  describe('when the duration is signed', () => {
    it('prefixes the direction', () => {
      expect(formatDuration(72_000, { signed: true })).toBe('+1m 12s');
      expect(formatDuration(-72_000, { signed: true })).toBe('-1m 12s');
      expect(formatDuration(0, { signed: true })).toBe('0ms');
    });
  });

  describe('when the duration is unusable', () => {
    it('returns undefined', () => {
      expect(formatDuration(-1)).toBeUndefined();
      expect(formatDuration(Number.NaN)).toBeUndefined();
      expect(formatDuration(Number.POSITIVE_INFINITY, { signed: true })).toBeUndefined();
    });
  });
});

describe('formatDurationPrecise', () => {
  it('keeps millisecond precision for timelines', () => {
    expect(formatDurationPrecise(0)).toBe('0 ms');
    expect(formatDurationPrecise(123.4)).toBe('123 ms');
    expect(formatDurationPrecise(1000)).toBe('1.000 s');
    expect(formatDurationPrecise(46_301)).toBe('46.301 s');
  });

  it('returns undefined when unusable', () => {
    expect(formatDurationPrecise(-5)).toBeUndefined();
    expect(formatDurationPrecise(Number.NaN)).toBeUndefined();
  });
});

describe('formatElapsed', () => {
  it('renders a stable one-decimal seconds counter', () => {
    expect(formatElapsed(0)).toBe('0.0s');
    expect(formatElapsed(3240)).toBe('3.2s');
    expect(formatElapsed(65_000)).toBe('65.0s');
  });
});
