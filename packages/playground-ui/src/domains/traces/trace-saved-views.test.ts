import { describe, expect, it } from 'vitest';
import { fromTraceViewContent, toTraceViewContent, traceViewSettingsSchema } from './trace-saved-views';
import type { TraceViewSettings, TracesViewState } from './trace-saved-views';

const shown: TracesViewState = {
  filters: {
    datePreset: 'custom',
    dateFrom: new Date('2026-10-01T00:00:00.000Z'),
    dateTo: new Date('2026-10-02T00:00:00.000Z'),
    tokens: [
      { fieldId: 'status', value: 'error' },
      { fieldId: 'tags', value: ['a', 'b'] },
      { fieldId: 'environment', value: 'staging', operatorId: 'isNot' },
    ],
    groups: [
      {
        id: 'g1',
        logic: 'or',
        nodes: [
          { id: 'n1', fieldId: 'environment', value: 'production' },
          { id: 'n2', fieldId: 'durationMs', value: '100', operatorId: 'gt' },
        ],
      },
    ],
  },
  sortDirection: 'asc',
  columns: {
    preferences: { visibleColumns: ['type', 'duration'], customColumns: ['traceId'], metadataKeys: ['tier'] },
    order: ['metadata:tier', 'name'],
  },
};

const settings = (overrides: Record<string, unknown> = {}) => ({
  datePreset: 'last-24h',
  groups: [],
  sortDirection: 'desc',
  columns: { visibleColumns: [], customColumns: [], metadataKeys: [], order: [] },
  ...overrides,
});

// What the server hands back: the settings went through JSON and are read back through the schema.
const reload = (value: unknown): TraceViewSettings => traceViewSettingsSchema.parse(JSON.parse(JSON.stringify(value)));

describe('trace view content', () => {
  describe('when a view is saved and opened again', () => {
    it('shows the same filters, time range, sort and columns', () => {
      const content = toTraceViewContent(shown);

      expect(fromTraceViewContent({ filters: content.filters, settings: reload(content.settings) })).toEqual(shown);
    });

    it('keeps the top-level filters as chips and the AND/OR groups in the settings', () => {
      const content = toTraceViewContent(shown);

      expect(content.filters).toEqual([
        { id: 'status', fieldId: 'status', operatorId: 'is', value: 'error' },
        { id: 'tags', fieldId: 'tags', operatorId: 'in', value: ['a', 'b'] },
        { id: 'environment', fieldId: 'environment', operatorId: 'isNot', value: 'staging' },
      ]);
      expect(content.settings.groups).toEqual(shown.filters.groups);
    });
  });

  describe('when a view holds settings this Studio does not know', () => {
    it('opens a time range it does not offer on the default', () => {
      expect(reload(settings({ datePreset: 'last-90d' })).datePreset).toBe('last-7d');
      expect(reload(settings({ datePreset: 'all' })).datePreset).toBe('last-7d');
      expect(reload(settings({ datePreset: 'last-3d' })).datePreset).toBe('last-3d');
    });

    it('drops the columns it does not know and keeps the rest', () => {
      const columns = reload(
        settings({
          columns: {
            visibleColumns: ['duration', 'sparkle'],
            customColumns: ['traceId', 'nope'],
            metadataKeys: ['tier'],
          },
        }),
      ).columns;

      expect(columns).toEqual({
        visibleColumns: ['duration'],
        customColumns: ['traceId'],
        metadataKeys: ['tier'],
        order: [],
      });
    });

    it('drops a malformed group and keeps the others', () => {
      const group = { id: 'g1', logic: 'and', nodes: [{ id: 'n1', fieldId: 'status', value: 'error' }] };

      expect(reload(settings({ groups: [{ logic: 'xor', nodes: [] }, group] })).groups).toEqual([group]);
      expect(reload(settings({ groups: 'not a list' })).groups).toEqual([]);
    });

    it('sorts newest first when the sort is not one it knows', () => {
      expect(reload(settings({ sortDirection: 'sideways' })).sortDirection).toBe('desc');
    });

    it('uses the default column order when the view has none', () => {
      const { order: _order, ...columns } = settings().columns;

      expect(reload(settings({ columns })).columns.order).toEqual([]);
    });
  });
});
