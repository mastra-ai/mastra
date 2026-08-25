import { act, renderHook, waitFor } from '@testing-library/react';
import Papa from 'papaparse';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

/**
 * The blocks above drive the real papaparse over real files. These pin the
 * hook's side of the contract *with* papaparse — the config it asks for and
 * how it handles the callbacks — which a real parse cannot show: a >1MB file
 * would have to actually exist, and papaparse never invokes its `error`
 * callback for a well-formed File in jsdom.
 */
describe('what the hook asks papaparse to do', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Captures the parse config and hands back its callbacks to drive by hand. */
  const captureParse = () => {
    const captured: { config?: Papa.ParseLocalConfig<Record<string, string>, File> } = {};
    vi.spyOn(Papa, 'parse').mockImplementation(((_file: unknown, config: unknown) => {
      captured.config = config as Papa.ParseLocalConfig<Record<string, string>, File>;
    }) as typeof Papa.parse);
    return captured;
  };

  const fileOfSize = (size: number) => {
    const file = csvFile('input\na\n');
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  it('asks for a header row, greedy blank-line skipping and no type coercion', async () => {
    const captured = captureParse();
    const { result } = renderHook(() => useCSVParser());

    await act(async () => {
      void result.current.parseFile(fileOfSize(10));
    });

    expect(captured.config).toMatchObject({
      header: true,
      skipEmptyLines: 'greedy',
      // Cells are handed to our own JSON parser, so papaparse must not guess
      // types first — a numeric-looking id has to stay a string.
      dynamicTyping: false,
    });
  });

  it.each([
    ['a small file', 10, false],
    ['a file at the threshold', 1_000_000, false],
    ['a file over the threshold', 1_000_001, true],
  ])('parses %s off the main thread: %s', async (_label, size, worker) => {
    const captured = captureParse();
    const { result } = renderHook(() => useCSVParser());

    await act(async () => {
      void result.current.parseFile(fileOfSize(size));
    });

    expect(captured.config?.worker).toBe(worker);
  });

  it('reports itself parsing until the callback lands', async () => {
    const captured = captureParse();
    const { result } = renderHook(() => useCSVParser());

    await act(async () => {
      void result.current.parseFile(fileOfSize(10));
    });
    expect(result.current.isParsing).toBe(true);

    await act(async () => {
      captured.config?.complete?.(
        { data: [], errors: [], meta: { fields: ['input'] } } as unknown as Papa.ParseResult<Record<string, string>>,
        undefined as never,
      );
    });

    await waitFor(() => expect(result.current.isParsing).toBe(false));
  });

  it('reports no headers when papaparse names none', async () => {
    const captured = captureParse();
    const { result } = renderHook(() => useCSVParser());

    let parsed: Awaited<ReturnType<typeof result.current.parseFile>> | undefined;
    await act(async () => {
      void result.current.parseFile(fileOfSize(10)).then(value => {
        parsed = value;
      });
    });

    await act(async () => {
      captured.config?.complete?.(
        { data: [], errors: [], meta: {} } as unknown as Papa.ParseResult<Record<string, string>>,
        undefined as never,
      );
    });

    await waitFor(() => expect(parsed?.headers).toEqual([]));
  });

  it('surfaces a papaparse failure to the caller', async () => {
    const captured = captureParse();
    const { result } = renderHook(() => useCSVParser());

    let rejection: unknown;
    await act(async () => {
      void result.current.parseFile(fileOfSize(10)).catch(error => {
        rejection = error;
      });
    });

    await act(async () => {
      captured.config?.error?.(new Error('unterminated quote') as Papa.ParseError, fileOfSize(10));
    });

    await waitFor(() => expect((rejection as Error)?.message).toBe('unterminated quote'));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.isParsing).toBe(false);
  });

  it('clears the previous error when a new parse starts', async () => {
    vi.spyOn(Papa, 'parse').mockImplementation((() => {
      throw new Error('boom');
    }) as typeof Papa.parse);
    const { result } = renderHook(() => useCSVParser());

    await act(async () => {
      await result.current.parseFile(csvFile('input\na\n')).catch(() => {});
    });
    expect(result.current.error).toBeInstanceOf(Error);

    const captured = captureParse();
    await act(async () => {
      void result.current.parseFile(fileOfSize(10));
    });

    expect(result.current.error).toBeNull();
    expect(captured.config).toBeDefined();
  });
});
