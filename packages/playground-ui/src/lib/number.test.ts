import { describe, expect, it } from 'vitest';
import { formatBytes as formatExportedBytes } from '../utils/number';
import { formatBytes, formatPercent } from './number';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [-0, '0 B'],
    [0.49, '0 B'],
    [0.5, '1 B'],
    [512, '512 B'],
    [1023.5, '1024 B'],
    [1024 ** 2 - 1, '1024 KB'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [10 * 1024 + 300, '10 KB'],
    [125 * 1024 ** 2, '125 MB'],
    [2.25 * 1024 ** 3, '2.3 GB'],
    [1024 ** 4, '1 TB'],
    [1024 ** 5, '1 PB'],
    [5 * 1024 ** 6, '5120 PB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined])(
    'returns undefined for %s',
    bytes => {
      expect(formatBytes(bytes)).toBeUndefined();
    },
  );
});

describe('formatBytes with a source unit', () => {
  it.each([
    [1536, 'B', '1536 B'],
    [1024, 'KB', '1024 KB'],
    [0.5, 'MB', '0.5 MB'],
    [0.001, 'GB', '0.001 GB'],
    [2048, 'GB', '2048 GB'],
    [1.2345, 'TB', '1.2345 TB'],
    [1024, 'PB', '1024 PB'],
    [0, 'GB', '0 GB'],
  ] as const)('keeps %s %s in the source unit unless scaling is enabled', (value, unit, expected) => {
    expect(formatBytes(value, { unit })).toBe(expected);
    expect(formatBytes(value, { unit, autoScale: false })).toBe(expected);
  });

  it.each([
    [0.5, 'GB', '512 MB'],
    [2048, 'GB', '2 TB'],
    [0.001, 'GB', '1 MB'],
    [0.000001, 'GB', '1 KB'],
    [0.5, 'PB', '512 TB'],
    [1048576, 'KB', '1 GB'],
    [1000, 'B', '1000 B'],
    [1000, 'KB', '1000 KB'],
    [1024, 'B', '1 KB'],
    [1024, 'KB', '1 MB'],
    [1024, 'MB', '1 GB'],
    [1024, 'GB', '1 TB'],
    [1024, 'TB', '1 PB'],
    [1024, 'PB', '1024 PB'],
    [1 / 1024, 'KB', '1 B'],
    [1 / 1024, 'MB', '1 KB'],
    [1 / 1024, 'GB', '1 MB'],
    [1 / 1024, 'TB', '1 GB'],
    [1 / 1024, 'PB', '1 TB'],
    [0.49, 'B', '0 B'],
    [0.5, 'B', '1 B'],
    [0, 'GB', '0 B'],
    [1.2345, 'GB', '1.2 GB'],
    [12.345, 'GB', '12 GB'],
    [1023.49, 'MB', '1023 MB'],
    [1023.5, 'B', '1 KB'],
    [1023.5, 'MB', '1 GB'],
    [1023.5, 'TB', '1 PB'],
    [1023.5, 'PB', '1024 PB'],
    [0.9998, 'GB', '1 GB'],
    [Number.MIN_VALUE, 'PB', '0 B'],
    [Number.MAX_VALUE, 'PB', `${Number.MAX_VALUE} PB`],
  ] as const)('auto-scales %s %s as %s only when enabled', (value, unit, expected) => {
    expect(formatBytes(value, { unit, autoScale: true })).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined])(
    'returns undefined for invalid or missing measurements: %s',
    value => {
      expect(formatBytes(value, { unit: 'GB' })).toBeUndefined();
      expect(formatBytes(value, { unit: 'GB', autoScale: false })).toBeUndefined();
      expect(formatBytes(value, { unit: 'GB', autoScale: true })).toBeUndefined();
    },
  );

  it('exposes source-unit formatting through the public number utility', () => {
    expect(formatExportedBytes(0.5, { unit: 'GB', autoScale: true })).toBe('512 MB');
    expect(formatExportedBytes(2048, { unit: 'GB' })).toBe('2048 GB');
    expect(formatExportedBytes(1536)).toBe('1.5 KB');
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
