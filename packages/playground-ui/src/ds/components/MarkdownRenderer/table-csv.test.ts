import { describe, expect, it } from 'vitest';
import { tableToCsv } from './table-csv';

describe('Table CSV', () => {
  describe('when cells contain CSV special characters', () => {
    it('quotes cells and preserves commas, quotes, line breaks, Unicode and empty cells', () => {
      expect(
        tableToCsv([
          ['Name', 'Value'],
          ['東京, Paris', 'say "hello"'],
          ['two\nlines', ''],
        ]),
      ).toBe('"Name","Value"\r\n"東京, Paris","say ""hello"""\r\n"two\nlines",""');
    });
  });

  describe('when a cell could be evaluated as a spreadsheet formula', () => {
    it.each([
      '=1+1',
      '+SUM(A1)',
      '-1+2',
      '@SUM(A1)',
      '  =HYPERLINK("url")',
      '\t123',
      '\r123',
      '\n123',
      '＝1+1',
      '＋1',
      '－1',
      '＠SUM(A1)',
    ])('exports %j as text', value => expect(tableToCsv([[value]])).toBe(`"'${value.replaceAll('"', '""')}"`));
  });

  describe('when cells contain ordinary numeric values', () => {
    it.each(['-42', '+12', '-3.50', '-.5', '-.55', '-1e5', '-1e-12', '-1e-5', '  -42', '12', 'text', 'a=b'])(
      'preserves %j without adding a text prefix',
      value => expect(tableToCsv([[value]])).toBe(`"${value}"`),
    );
  });
});
