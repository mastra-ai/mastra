import { describe, expect, it } from 'vitest';
import { formatBytes, formatPercent } from './number';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [10 * 1024 + 300, '10 KB'],
    [125 * 1024 ** 2, '125 MB'],
    [2.25 * 1024 ** 3, '2.3 GB'],
    [5 * 1024 ** 6, '5120 PB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined])('returns undefined for %s', bytes => {
    expect(formatBytes(bytes)).toBeUndefined();
  });
});

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [0.42, '42%'],
    [0.4256, '42.6%'],
    [1, '100%'],
    [1.5, '150%'],
    [-0.12, '-12%'],
    [0.0004, '<0.1%'],
    [-0.0004, '-<0.1%'],
  ])('formats %d as %s', (ratio, expected) => {
    expect(formatPercent(ratio)).toBe(expected);
  });

  it.each([Number.NaN, null, undefined])('returns undefined for %s', ratio => {
    expect(formatPercent(ratio)).toBeUndefined();
  });

  it.each([
    [0.123, '+12.3%'],
    [-0.123, '-12.3%'],
    [0, '0%'],
    [0.0004, '+<0.1%'],
  ])('signs %d as %s', (ratio, expected) => {
    expect(formatPercent(ratio, { signed: true })).toBe(expected);
  });
});
