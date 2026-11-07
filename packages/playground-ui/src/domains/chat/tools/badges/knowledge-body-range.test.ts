import { describe, expect, it } from 'vitest';
import { readExtent, writeExtent } from './knowledge-body-range';

const at = (line: number, col?: number) => (col === undefined ? { line } : { line, col });

describe('readExtent', () => {
  describe('when the whole page came back', () => {
    it('says nothing extra in the row and "whole page" when opened', () => {
      const extent = readExtent({ page: { body: '# Hi' } }, {});
      expect(extent).toEqual({ row: undefined, summary: 'Whole page' });
    });

    it('calls a page with no body empty, rather than a whole page', () => {
      expect(readExtent({ page: {} }, {})).toEqual({ row: 'empty page', summary: 'The page has no body' });
      expect(readExtent({ page: {} }, { section: 'Setup' })?.row).toBe('empty page');
    });
  });

  describe('when a window of lines came back', () => {
    const page = { lines: '60│a', range: { start: at(60), end: at(95) }, lineCount: 133 };

    it('names the lines and how many the page has', () => {
      expect(readExtent({ page }, { from: at(60) })).toEqual({
        row: 'lines 60–95 of 133',
        summary: 'Lines 60–95 of 133, continues at line 96',
      });
    });

    it('says it is the end when the window reaches the last line', () => {
      const last = { ...page, range: { start: at(120), end: at(133) } };
      expect(readExtent({ page: last }, { from: at(120) })).toEqual({
        row: 'lines 120–133 of 133',
        summary: 'Lines 120–133 of 133, end of page',
      });
    });

    it('shows a single line as one', () => {
      const one = { ...page, range: { start: at(7), end: at(7) } };
      expect(readExtent({ page: one }, {})?.row).toBe('line 7 of 133');
    });

    it('keeps the column when the window starts or ends inside a long line', () => {
      const cut = { ...page, range: { start: at(5, 200), end: at(9, 40) } };
      expect(readExtent({ page: cut }, {})?.row).toBe('lines 5:200–9:40 of 133');
    });

    it('names the section the lines came from', () => {
      expect(readExtent({ page }, { section: 'Setup' })?.row).toBe('section "Setup", lines 60–95 of 133');
    });
  });

  describe('when a long page came back as its headings', () => {
    it('says it is an overview of the page, not a window', () => {
      expect(readExtent({ page: { lines: '1│# A', lineCount: 400 } }, {})).toEqual({
        row: 'overview of 400 lines',
        summary: 'Overview: every heading and the first lines under it, of 400 lines',
      });
    });
  });

  describe('when matches came back', () => {
    const matches = [
      { range: { start: at(3), end: at(8) }, lines: '3│x' },
      { range: { start: at(40), end: at(44) }, lines: '40│y' },
    ];

    it('names the terms and the context around each', () => {
      expect(readExtent({ page: { matches, lineCount: 90 } }, { match: ['kv', 'queue'], context: 2 })).toEqual({
        row: 'matches "kv", "queue" ±2',
        summary: '2 matches for "kv", "queue" with 2 lines of context: lines 3–8, 40–44 of 90',
      });
    });

    it('says the matches are the first ones when the read stopped at its token cap', () => {
      const output = {
        page: { matches, lineCount: 90 },
        more: ['match: stopped at about 4,000 tokens; more matches from line 52. Read again with the same match.'],
      };
      expect(readExtent(output, { match: ['kv'] })).toEqual({
        row: 'matches "kv"',
        summary: 'First 2 matches for "kv", more follow: lines 3–8, 40–44 of 90',
      });
    });

    it('says so when nothing matched', () => {
      expect(readExtent({ page: { matches: [], lineCount: 90 } }, { match: ['zzz'] })).toEqual({
        row: 'no matches "zzz"',
        summary: 'No line contains "zzz" (90 lines)',
      });
    });
  });

  describe('when only the outline was asked for', () => {
    it('says outline', () => {
      expect(readExtent({ page: { outline: [{ line: 1, title: 'A' }], lineCount: 50 } }, { outline: true })?.row).toBe(
        'outline',
      );
    });
  });

  describe('when the result has no page, or is a notes-only read', () => {
    it('says nothing', () => {
      expect(readExtent({}, {})).toBeUndefined();
      expect(readExtent({ page: { id: 'p' }, notes: [] }, { notes: true })).toBeUndefined();
    });
  });
});

describe('writeExtent', () => {
  it('says nothing for a write of the whole body', () => {
    expect(writeExtent({ body: 'x' })).toBeUndefined();
  });

  it('names the lines a range write replaced', () => {
    expect(writeExtent({ body: 'new', range: { start: at(12), end: at(14) } })).toEqual({
      row: 'lines 12–14',
      summary: 'Replaced lines 12–14',
    });
  });

  it('says removed when the replacement is empty', () => {
    expect(writeExtent({ body: '', range: { start: at(12), end: at(12) } })).toEqual({
      row: 'line 12',
      summary: 'Removed line 12',
    });
  });

  it('keeps columns', () => {
    expect(writeExtent({ body: 'x', range: { start: at(2, 5), end: at(2, 9) } })?.row).toBe('line 2:5–9');
  });
});
