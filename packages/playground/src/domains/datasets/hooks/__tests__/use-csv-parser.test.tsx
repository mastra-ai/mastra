import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCSVParser } from '../use-csv-parser';

/**
 * Drives the real papaparse pipeline over a real File, so the hook's own
 * contract is exercised: header extraction, per-row JSON cell parsing, and the
 * 1-based-plus-header row numbering used in warnings.
 */
const csvFile = (contents: string, name = 'items.csv') => new File([contents], name, { type: 'text/csv' });

const parse = async (contents: string) => {
  const { result } = renderHook(() => useCSVParser());
  let parsed: Awaited<ReturnType<typeof result.current.parseFile>> | undefined;

  await act(async () => {
    parsed = await result.current.parseFile(csvFile(contents));
  });

  return { parsed: parsed!, result };
};

describe('useCSVParser', () => {
  describe('when the file is a plain CSV', () => {
    it('reports the header row', async () => {
      const { parsed } = await parse('input,groundTruth\nhello,world\n');

      expect(parsed.headers).toEqual(['input', 'groundTruth']);
    });

    it('reports one row per record', async () => {
      const { parsed } = await parse('input,groundTruth\na,1\nb,2\n');

      expect(parsed.data).toEqual([
        { input: 'a', groundTruth: '1' },
        { input: 'b', groundTruth: '2' },
      ]);
    });

    it('skips blank lines rather than emitting empty rows', async () => {
      const { parsed } = await parse('input\na\n\n\nb\n');

      expect(parsed.data).toHaveLength(2);
    });

    it('leaves numeric-looking cells as strings', async () => {
      const { parsed } = await parse('input\n42\n');

      expect(parsed.data[0]?.input).toBe('42');
    });

    it('reports no warnings', async () => {
      const { parsed } = await parse('input\nhello\n');

      expect(parsed.warnings).toEqual([]);
    });
  });

  describe('when a cell holds JSON', () => {
    it('parses it into a value', async () => {
      const { parsed } = await parse('input\n"{""question"":""hi""}"\n');

      expect(parsed.data[0]?.input).toEqual({ question: 'hi' });
    });
  });

  describe('when a cell holds malformed JSON', () => {
    it('numbers the warning by the spreadsheet row, counting the header', async () => {
      const { parsed } = await parse('input\nok\n"{""broken"": }"\n');

      expect(parsed.warnings).toHaveLength(1);
      // Header is row 1, first record row 2, so the second record is row 3.
      expect(parsed.warnings[0]).toMatch(/^Row 3: /);
    });

    it('numbers a first-record warning as row 2', async () => {
      const { parsed } = await parse('input\n"{""broken"": }"\n');

      expect(parsed.warnings[0]).toMatch(/^Row 2: /);
    });
  });

  describe('while a file is being parsed', () => {
    it('reports parsing and then settles', async () => {
      const { result } = renderHook(() => useCSVParser());

      expect(result.current.isParsing).toBe(false);

      await act(async () => {
        await result.current.parseFile(csvFile('input\na\n'));
      });

      await waitFor(() => expect(result.current.isParsing).toBe(false));
      expect(result.current.error).toBeNull();
    });
  });

  describe('when the file is empty', () => {
    it('reports no rows rather than throwing', async () => {
      const { parsed } = await parse('');

      expect(parsed.data).toEqual([]);
      expect(parsed.headers).toEqual([]);
    });
  });
});
