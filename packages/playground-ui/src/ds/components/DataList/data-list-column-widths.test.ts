import { describe, expect, it } from 'vitest';

import { applyColumnWidths, getColumnWidthKey, getColumnWidthsStorageKey } from './data-list-column-widths';

describe('data-list column widths', () => {
  it('builds the storage key and column keys', () => {
    expect(getColumnWidthsStorageKey('runs')).toBe('mastra:data-list:column-widths:runs');
    expect(getColumnWidthKey(1)).toBe('1');
    expect(getColumnWidthKey(1, ['a', 'b'])).toBe('b');
    expect(getColumnWidthKey(5, ['a', 'b'])).toBe('5');
  });

  it('returns the tracks untouched without stored widths', () => {
    const tracks = ['10rem', '1fr'];
    expect(applyColumnWidths(tracks, undefined)).toBe(tracks);
    expect(applyColumnWidths(tracks, {})).toEqual(tracks);
  });

  it('replaces resized tracks by index', () => {
    expect(applyColumnWidths(['10rem', '1fr', 'auto'], { '1': 120 })).toEqual(['10rem', '120px', 'auto']);
  });

  it('replaces resized tracks by key and ignores unknown keys and indexes', () => {
    expect(
      applyColumnWidths(['10rem', '1fr', 'auto'], { status: 90, gone: 50, '7': 40 }, ['name', 'status', 'date']),
    ).toEqual(['10rem', '90px', 'auto']);
    expect(applyColumnWidths(['10rem', '1fr'], { '5': 40 })).toEqual(['10rem', '1fr']);
  });
});
