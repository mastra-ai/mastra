import { describe, expect, it } from 'vitest';
import { formatAxisCount, formatAxisDuration, formatAxisUsd, formatCount, formatDuration } from './chart-format';

describe('formatCount', () => {
  it.each([
    [812, '812'],
    [1_250, '1.25K'],
    [34_500, '34.5K'],
    [1_200_000, '1.2M'],
    [13_036_900_000, '13.0B'],
  ])('formats %d as %s', (value, text) => {
    expect(formatCount(value)).toBe(text);
  });
});

describe('formatAxisCount', () => {
  it.each([
    [600, '600'],
    [4_500, '4.5K'],
    [1_200_000, '1.2M'],
    [13_000_000_000, '13B'],
  ])('formats %d as %s', (value, text) => {
    expect(formatAxisCount(value)).toBe(text);
  });
});

describe('formatDuration', () => {
  it.each([
    [84, '84ms'],
    [1_250, '1.25s'],
    [12_400, '12.4s'],
    [270_000, '4.5m'],
    [12_817_100, '3.6h'],
  ])('formats %dms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('formatAxisDuration', () => {
  it.each([
    [250, '250ms'],
    [1_500, '1.5s'],
    [270_000, '4.5m'],
    [10_800_000, '3h'],
  ])('formats %dms as %s', (ms, text) => {
    expect(formatAxisDuration(ms)).toBe(text);
  });
});

describe('formatAxisUsd', () => {
  it('drops trailing zeros on round ticks', () => {
    expect([0, 2.5, 5].map(formatAxisUsd)).toEqual(['$0', '$2.5', '$5']);
  });

  it('keeps every digit of a fractional tick', () => {
    expect([0.25, 0.75, 12.5].map(formatAxisUsd)).toEqual(['$0.25', '$0.75', '$12.5']);
  });

  it('drops float noise from computed ticks', () => {
    expect(formatAxisUsd(0.1 + 0.2)).toBe('$0.3');
  });

  it('shortens thousands', () => {
    expect([1_000, 2_500, 1_500_000].map(formatAxisUsd)).toEqual(['$1K', '$2.5K', '$1.5M']);
  });
});
