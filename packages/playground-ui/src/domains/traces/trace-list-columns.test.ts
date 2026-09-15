import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRACE_COLUMN_PREFERENCES,
  TRACE_OPTIONAL_COLUMNS,
  TRACE_USAGE_COLUMNS,
  buildTraceListColumns,
  formatTraceMetadataValue,
  hasTraceColumn,
  hasTraceUsageColumn,
  isTraceUsageColumn,
  parseTraceColumnPreferences,
  serializeTraceColumnPreferences,
} from './trace-list-columns';

describe('trace list columns', () => {
  describe('when saved preferences are missing or invalid', () => {
    it('uses the default columns', () => {
      expect(parseTraceColumnPreferences(undefined)).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
      expect(parseTraceColumnPreferences('{not-json')).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });

    it('drops columns that are not strings at all', () => {
      expect(
        parseTraceColumnPreferences(
          JSON.stringify({ version: 1, visibleColumns: ['input', 42, null, { id: 'duration' }] }),
        ),
      ).toEqual({ visibleColumns: ['input'], metadataKeys: [] });
    });

    it('drops unknown columns and invalid metadata keys', () => {
      expect(
        parseTraceColumnPreferences(
          JSON.stringify({
            version: 1,
            visibleColumns: ['input', 'unknown', 'duration'],
            metadataKeys: ['tenant', '', 42, 'tenant'],
          }),
        ),
      ).toEqual({
        visibleColumns: ['input', 'duration'],
        metadataKeys: ['tenant'],
      });
    });
  });

  describe('when preferences are saved and restored', () => {
    it('round trips the selected columns', () => {
      const preferences = {
        visibleColumns: ['entity', 'inputTokens', 'estimatedCost'] as const,
        metadataKeys: ['tenant', 'request.kind'],
      };

      expect(parseTraceColumnPreferences(serializeTraceColumnPreferences(preferences))).toEqual(preferences);
    });
  });

  describe('when the grid is built', () => {
    it('keeps the existing default layout', () => {
      expect(buildTraceListColumns(DEFAULT_TRACE_COLUMN_PREFERENCES)).toBe('11rem 14rem minmax(8rem,1fr) 14rem 6rem');
    });

    it('adds bounded tracks for optional and metadata columns', () => {
      expect(
        buildTraceListColumns({
          visibleColumns: ['duration', 'inputTokens', 'outputTokens', 'estimatedCost'],
          metadataKeys: ['tenant'],
        }),
      ).toBe('11rem minmax(8rem,1fr) 6rem 7rem 8rem 8rem 8rem minmax(8rem,14rem)');
    });
  });

  describe('when metadata is displayed', () => {
    it('preserves falsy values and serializes structured values', () => {
      expect(formatTraceMetadataValue({ count: 0 }, 'count')).toBe('0');
      expect(formatTraceMetadataValue({ cached: false }, 'cached')).toBe('false');
      expect(formatTraceMetadataValue({ context: { tenant: 'acme' } }, 'context')).toBe('{"tenant":"acme"}');
    });

    it('leaves missing and null values empty', () => {
      expect(formatTraceMetadataValue({ tenant: null }, 'tenant')).toBeUndefined();
      expect(formatTraceMetadataValue({}, 'tenant')).toBeUndefined();
      expect(formatTraceMetadataValue(undefined, 'tenant')).toBeUndefined();
    });
  });

  describe('the column catalogue', () => {
    it('lists the optional columns in display order', () => {
      expect(TRACE_OPTIONAL_COLUMNS).toEqual([
        'input',
        'entity',
        'duration',
        'inputTokens',
        'outputTokens',
        'estimatedCost',
      ]);
    });

    it('treats only the token and cost columns as usage columns', () => {
      expect(TRACE_USAGE_COLUMNS).toEqual(['inputTokens', 'outputTokens', 'estimatedCost']);
      expect(TRACE_OPTIONAL_COLUMNS.filter(isTraceUsageColumn)).toEqual([...TRACE_USAGE_COLUMNS]);
    });

    it('shows input and entity by default', () => {
      expect(DEFAULT_TRACE_COLUMN_PREFERENCES).toEqual({ visibleColumns: ['input', 'entity'], metadataKeys: [] });
    });
  });

  describe('when saved preferences come from another version', () => {
    it('ignores a payload written by a different version', () => {
      expect(parseTraceColumnPreferences(JSON.stringify({ version: 2, visibleColumns: ['duration'] }))).toEqual(
        DEFAULT_TRACE_COLUMN_PREFERENCES,
      );
      expect(parseTraceColumnPreferences(JSON.stringify({ visibleColumns: ['duration'] }))).toEqual(
        DEFAULT_TRACE_COLUMN_PREFERENCES,
      );
    });

    it('ignores a payload that is not an object', () => {
      expect(parseTraceColumnPreferences('[]')).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
      expect(parseTraceColumnPreferences('"text"')).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
      expect(parseTraceColumnPreferences('null')).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });

    it('treats an empty string as no saved preferences', () => {
      expect(parseTraceColumnPreferences('')).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });

    it('falls back to the default columns when visibleColumns is not an array', () => {
      expect(parseTraceColumnPreferences(JSON.stringify({ version: 1, visibleColumns: 'input' }))).toEqual(
        DEFAULT_TRACE_COLUMN_PREFERENCES,
      );
    });

    it('keeps an explicitly empty column list', () => {
      expect(parseTraceColumnPreferences(JSON.stringify({ version: 1, visibleColumns: [] }))).toEqual({
        visibleColumns: [],
        metadataKeys: [],
      });
    });

    it('drops duplicate columns and trims metadata keys', () => {
      expect(
        parseTraceColumnPreferences(
          JSON.stringify({ version: 1, visibleColumns: ['input', 'input'], metadataKeys: [' tenant ', 'tenant'] }),
        ),
      ).toEqual({ visibleColumns: ['input'], metadataKeys: ['tenant'] });
    });

    it('ignores metadata keys that are not an array', () => {
      expect(parseTraceColumnPreferences(JSON.stringify({ version: 1, metadataKeys: 'tenant' })).metadataKeys).toEqual(
        [],
      );
    });
  });

  describe('when preferences are written', () => {
    it('stamps the payload with its version', () => {
      expect(JSON.parse(serializeTraceColumnPreferences(DEFAULT_TRACE_COLUMN_PREFERENCES))).toEqual({
        version: 1,
        visibleColumns: ['input', 'entity'],
        metadataKeys: [],
      });
    });
  });

  describe('when a single optional column is toggled', () => {
    it.each([
      ['input', '11rem 14rem minmax(8rem,1fr) 6rem'],
      ['entity', '11rem minmax(8rem,1fr) 14rem 6rem'],
      ['duration', '11rem minmax(8rem,1fr) 6rem 7rem'],
      ['inputTokens', '11rem minmax(8rem,1fr) 6rem 8rem'],
      ['outputTokens', '11rem minmax(8rem,1fr) 6rem 8rem'],
      ['estimatedCost', '11rem minmax(8rem,1fr) 6rem 8rem'],
    ] as const)('lays out %s on its own', (column, expected) => {
      expect(buildTraceListColumns({ visibleColumns: [column], metadataKeys: [] })).toBe(expected);
    });

    it('widens the second track only when input is hidden', () => {
      expect(buildTraceListColumns({ visibleColumns: [], metadataKeys: [] })).toBe('11rem minmax(8rem,1fr) 6rem');
    });

    it('adds one bounded track per metadata key', () => {
      expect(buildTraceListColumns({ visibleColumns: [], metadataKeys: ['a', 'b'] })).toBe(
        '11rem minmax(8rem,1fr) 6rem minmax(8rem,14rem) minmax(8rem,14rem)',
      );
    });
  });

  describe('when metadata is displayed', () => {
    it('renders a plain string as itself, not as JSON', () => {
      expect(formatTraceMetadataValue({ tenant: 'acme' }, 'tenant')).toBe('acme');
    });

    it('renders a non-finite number as a number, not as null', () => {
      expect(formatTraceMetadataValue({ ratio: Number.NaN }, 'ratio')).toBe('NaN');
      expect(formatTraceMetadataValue({ ratio: Number.POSITIVE_INFINITY }, 'ratio')).toBe('Infinity');
    });

    it('renders a bigint without losing precision', () => {
      expect(formatTraceMetadataValue({ id: 9007199254740993n }, 'id')).toBe('9007199254740993');
    });

    it('leaves an undefined value empty', () => {
      expect(formatTraceMetadataValue({ tenant: undefined }, 'tenant')).toBeUndefined();
    });

    it('does not read inherited properties', () => {
      expect(formatTraceMetadataValue({}, 'toString')).toBeUndefined();
      expect(formatTraceMetadataValue({}, 'constructor')).toBeUndefined();
    });

    it('leaves a value it cannot serialize empty', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(formatTraceMetadataValue({ circular }, 'circular')).toBeUndefined();
      expect(formatTraceMetadataValue({ fn: () => {} }, 'fn')).toBeUndefined();
    });
  });

  describe('column lookups', () => {
    it('reports whether a single column is visible', () => {
      const preferences = { visibleColumns: ['input', 'duration'] as const, metadataKeys: [] };

      expect(hasTraceColumn(preferences, 'input')).toBe(true);
      expect(hasTraceColumn(preferences, 'entity')).toBe(false);
    });

    it('reports whether any usage column is visible', () => {
      expect(hasTraceUsageColumn({ visibleColumns: ['input', 'entity'], metadataKeys: [] })).toBe(false);
      expect(hasTraceUsageColumn({ visibleColumns: ['input', 'outputTokens'], metadataKeys: [] })).toBe(true);
      expect(hasTraceUsageColumn({ visibleColumns: [], metadataKeys: [] })).toBe(false);
    });
  });
});
