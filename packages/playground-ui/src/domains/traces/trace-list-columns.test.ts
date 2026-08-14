import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRACE_COLUMN_PREFERENCES,
  buildTraceListColumns,
  formatTraceMetadataValue,
  parseTraceColumnPreferences,
  serializeTraceColumnPreferences,
} from './trace-list-columns';

describe('trace list columns', () => {
  describe('when saved preferences are missing or invalid', () => {
    it('uses the default columns', () => {
      expect(parseTraceColumnPreferences(undefined)).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
      expect(parseTraceColumnPreferences('{not-json')).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
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
      expect(buildTraceListColumns(DEFAULT_TRACE_COLUMN_PREFERENCES)).toBe(
        '6rem 9rem 14rem minmax(8rem,1fr) 14rem 6rem',
      );
    });

    it('adds bounded tracks for optional and metadata columns', () => {
      expect(
        buildTraceListColumns({
          visibleColumns: ['duration', 'inputTokens', 'outputTokens', 'estimatedCost'],
          metadataKeys: ['tenant'],
        }),
      ).toBe('6rem 9rem minmax(14rem,1fr) 6rem 7rem 8rem 8rem 8rem minmax(8rem,14rem)');
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
});
