import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_TRACES_SELECTION,
  applyDate,
  applyDatePreset,
  applyDateRange,
  applyFilterTokens,
  buildTracesLegacyFilters,
  buildTracesQueryRequest,
  clearSelection,
  getSelectedEntityOption,
  getSelectedStatus,
  highlightSpans,
  isSelectionEmpty,
  resolveTracesDateWindow,
  sanitizeTracesFilters,
  selectScore,
  selectSpan,
  selectTrace,
  setSpanTab,
  setSpanView,
  TRACE_FILTER_NOT_ON_THIS_STORAGE,
  unsupportedTraceFilterReason,
} from '../traces-explorer-actions';
import type { TracesFilters, TracesSelection } from '../traces-explorer-actions';
import type { FilterBarGroup } from '@/ds/components/FilterBar';

const openTrace: TracesSelection = {
  traceId: 'trace-a',
  spanId: 'span-1',
  spanTab: 'feedback',
  spanView: 'timeline',
  scoreId: 'score-1',
  highlightSpanIds: ['span-1', 'span-2'],
};

const baseFilters: TracesFilters = { datePreset: 'last-7d', tokens: [], groups: [] };

describe('selectTrace', () => {
  describe('when another trace is selected', () => {
    it('drops every per-span detail but keeps the span view', () => {
      expect(selectTrace(openTrace, 'trace-b')).toEqual({
        traceId: 'trace-b',
        spanView: 'timeline',
        highlightSpanIds: [],
      });
    });
  });

  describe('when no trace is given', () => {
    it('clears the selection', () => {
      expect(selectTrace(openTrace, null)).toEqual({ spanView: 'timeline', highlightSpanIds: [] });
    });
  });
});

describe('clearSelection', () => {
  describe('when a trace is open', () => {
    it('keeps only the span view', () => {
      expect(clearSelection(openTrace)).toEqual({ spanView: 'timeline', highlightSpanIds: [] });
    });
  });
});

describe('isSelectionEmpty', () => {
  describe('when only the span view is set', () => {
    it('is empty', () => {
      expect(isSelectionEmpty({ ...EMPTY_TRACES_SELECTION, spanView: 'timeline' })).toBe(true);
    });
  });

  describe('when only a highlight is set', () => {
    it('is not empty', () => {
      expect(isSelectionEmpty({ ...EMPTY_TRACES_SELECTION, highlightSpanIds: ['span-1'] })).toBe(false);
    });
  });
});

describe('selectSpan', () => {
  describe('when another span is selected', () => {
    it('drops the previous span’s tab and score but keeps the highlight', () => {
      expect(selectSpan(openTrace, 'span-2')).toEqual({
        ...openTrace,
        spanId: 'span-2',
        spanTab: undefined,
        scoreId: undefined,
      });
    });
  });

  describe('when the span is already selected', () => {
    it('returns the same selection', () => {
      expect(selectSpan(openTrace, 'span-1')).toBe(openTrace);
    });
  });

  describe('when closing a span that is already closed', () => {
    it('returns the same selection', () => {
      const noSpan = { ...openTrace, spanId: undefined };
      expect(selectSpan(noSpan, null)).toBe(noSpan);
    });
  });
});

describe('setSpanTab', () => {
  describe('when a non-default tab is chosen', () => {
    it('stores it and clears the score', () => {
      const detailsTab = { ...openTrace, spanTab: undefined };
      expect(setSpanTab(detailsTab, 'feedback')).toEqual({ ...detailsTab, spanTab: 'feedback', scoreId: undefined });
    });
  });

  describe('when going back to the default tab', () => {
    it('leaves the tab unset', () => {
      expect(setSpanTab(openTrace, 'details').spanTab).toBeUndefined();
    });
  });

  describe('when the tab is already showing', () => {
    it('returns the same selection', () => {
      expect(setSpanTab(openTrace, 'feedback')).toBe(openTrace);
    });
  });
});

describe('setSpanView', () => {
  describe('when the view changes', () => {
    it('stores the new view and nothing else', () => {
      expect(setSpanView(openTrace, 'tree')).toEqual({ ...openTrace, spanView: 'tree' });
    });
  });

  describe('when the view is already showing', () => {
    it('returns the same selection', () => {
      expect(setSpanView(openTrace, 'timeline')).toBe(openTrace);
    });
  });
});

describe('selectScore', () => {
  describe('when a score is cleared', () => {
    it('touches nothing else', () => {
      expect(selectScore(openTrace, null)).toEqual({ ...openTrace, scoreId: undefined });
    });
  });

  describe('when the score is already selected', () => {
    it('returns the same selection', () => {
      expect(selectScore(openTrace, 'score-1')).toBe(openTrace);
    });
  });
});

describe('highlightSpans', () => {
  describe('when spans are highlighted', () => {
    it('replaces the highlight without changing the selected span', () => {
      expect(highlightSpans(openTrace, ['span-3'])).toEqual({ ...openTrace, highlightSpanIds: ['span-3'] });
    });
  });

  describe('when the same spans are highlighted again', () => {
    it('returns the same selection', () => {
      expect(highlightSpans(openTrace, ['span-1', 'span-2'])).toBe(openTrace);
    });
  });
});

describe('applyFilterTokens', () => {
  describe('when tokens and groups change', () => {
    it('replaces both and keeps the date window', () => {
      const custom: TracesFilters = { ...baseFilters, datePreset: 'custom', dateFrom: new Date(0) };
      const tokens = [{ fieldId: 'threadId', value: 'thread-1' }];
      const groups = [{ id: 'g', logic: 'or' as const, nodes: [] }];

      expect(applyFilterTokens(custom, tokens, groups)).toEqual({ ...custom, tokens, groups });
    });
  });
});

describe('applyDatePreset', () => {
  describe('when switching to custom', () => {
    it('keeps the existing dates so they can be adjusted', () => {
      const custom = { ...baseFilters, datePreset: 'custom' as const, dateFrom: new Date(0), dateTo: new Date(1) };
      expect(applyDatePreset({ ...custom, datePreset: 'last-24h' }, 'custom')).toEqual(custom);
    });
  });

  describe('when switching to a rolling window', () => {
    it('drops the custom dates', () => {
      const custom = { ...baseFilters, datePreset: 'custom' as const, dateFrom: new Date(0), dateTo: new Date(1) };
      expect(applyDatePreset(custom, 'last-3d')).toEqual({ ...baseFilters, datePreset: 'last-3d' });
    });
  });
});

describe('applyDate', () => {
  describe('when one end of a custom range changes', () => {
    it('writes just that end', () => {
      const custom = { ...baseFilters, datePreset: 'custom' as const, dateFrom: new Date(0), dateTo: new Date(1) };
      expect(applyDate(custom, undefined, 'to')).toEqual({ ...custom, dateTo: undefined });
    });
  });

  describe('when the picker reports a date after switching to a rolling preset', () => {
    it('ignores it', () => {
      const rolling = { ...baseFilters, datePreset: 'last-24h' as const };
      expect(applyDate(rolling, new Date(5), 'from')).toBe(rolling);
    });
  });
});

describe('applyDateRange', () => {
  describe('when both ends change', () => {
    it('writes both', () => {
      const from = new Date(5);
      expect(applyDateRange({ ...baseFilters, datePreset: 'custom' }, from, undefined)).toEqual({
        ...baseFilters,
        datePreset: 'custom',
        dateFrom: from,
        dateTo: undefined,
      });
    });
  });

  describe('when the picker reports a range after switching to a rolling preset', () => {
    it('ignores it', () => {
      const rolling = { ...baseFilters, datePreset: 'last-24h' as const };
      expect(applyDateRange(rolling, new Date(5), new Date(6))).toBe(rolling);
    });
  });
});

describe('sanitizeTracesFilters', () => {
  const traceQuery = { withQueryTrace: true, withRootDuration: false };

  describe('when the filters hold entries the trace query cannot run', () => {
    it('drops a running status, unsupported fields and root duration without support', () => {
      const filters: TracesFilters = {
        ...baseFilters,
        tokens: [
          { fieldId: 'status', value: 'running' },
          { fieldId: 'runId', value: 'run-1' },
          { fieldId: 'durationMs', value: '100', operatorId: 'gt' },
          { fieldId: 'threadId', value: 'thread-1' },
        ],
      };

      expect(sanitizeTracesFilters(filters, traceQuery).tokens).toEqual([{ fieldId: 'threadId', value: 'thread-1' }]);
    });
  });

  describe('when the server supports root duration', () => {
    it('keeps the duration token', () => {
      const filters: TracesFilters = { ...baseFilters, tokens: [{ fieldId: 'durationMs', value: '100' }] };
      expect(sanitizeTracesFilters(filters, { ...traceQuery, withRootDuration: true })).toBe(filters);
    });
  });

  describe('when the server lists traces through the legacy endpoint', () => {
    const legacy = { withQueryTrace: false, withRootDuration: false };

    it('keeps the fields that endpoint filters on, with is, and tags with any of', () => {
      const filters: TracesFilters = {
        ...baseFilters,
        tokens: [
          { fieldId: 'runId', value: 'run-1' },
          { fieldId: 'status', value: 'running' },
          { fieldId: 'tags', value: ['a', 'b'] },
        ],
      };

      expect(sanitizeTracesFilters(filters, legacy)).toBe(filters);
    });

    it('drops other fields, other operators and every group', () => {
      const filters: TracesFilters = {
        ...baseFilters,
        tokens: [
          { fieldId: 'environment', value: ['development'], operatorId: 'in' },
          { fieldId: 'environment', value: 'staging', operatorId: 'isNot' },
          { fieldId: 'spans.name', value: 'llm' },
          { fieldId: 'traceId', value: 'trace-a' },
        ],
        groups: [{ id: 'g', logic: 'or', nodes: [{ id: 'n', fieldId: 'status', value: 'error' }] }],
      };

      expect(sanitizeTracesFilters(filters, legacy)).toEqual({
        ...baseFilters,
        tokens: [{ fieldId: 'traceId', value: 'trace-a' }],
        groups: [],
      });
    });
  });
});

describe('getSelectedEntityOption / getSelectedStatus', () => {
  describe('when the tokens carry a known entity type and status', () => {
    it('reads them', () => {
      const tokens = [
        { fieldId: 'rootEntityType', value: 'agent' },
        { fieldId: 'status', value: 'error' },
      ];
      expect(getSelectedEntityOption(tokens)?.entityType).toBe('agent');
      expect(getSelectedStatus(tokens)).toBe('error');
    });
  });

  describe('when the tokens carry unknown values', () => {
    it('reads nothing', () => {
      const tokens = [
        { fieldId: 'rootEntityType', value: 'robot' },
        { fieldId: 'status', value: 'sleeping' },
      ];
      expect(getSelectedEntityOption(tokens)).toBeUndefined();
      expect(getSelectedStatus(tokens)).toBeUndefined();
    });
  });
});

describe('resolveTracesDateWindow', () => {
  afterEach(() => vi.useRealTimers());

  describe('when a rolling preset is active', () => {
    it('starts the window that far back and leaves the end open', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));

      expect(resolveTracesDateWindow('last-3d', new Date(0), new Date(1))).toEqual({
        dateFrom: new Date(Date.now() - 72 * 3600_000),
        dateTo: undefined,
      });
    });
  });

  describe('when a custom range is active', () => {
    it('uses the given ends', () => {
      expect(resolveTracesDateWindow('custom', undefined, new Date(1))).toEqual({
        dateFrom: undefined,
        dateTo: new Date(1),
      });
    });
  });
});

describe('buildTracesQueryRequest', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');
  const durationGroup = {
    id: 'group-duration',
    logic: 'or' as const,
    nodes: [
      { fieldId: 'durationMs', operatorId: 'gt', value: '1000' },
      { fieldId: 'threadId', operatorId: 'is', value: 'thread-1' },
    ],
  };
  const filters: TracesFilters = {
    ...baseFilters,
    tokens: [
      { fieldId: 'rootEntityType', value: 'agent' },
      { fieldId: 'status', value: 'error' },
      { fieldId: 'durationMs', operatorId: 'gt', value: '500' },
    ],
    groups: [durationGroup],
  };

  describe('when the tokens select a root entity type and a status', () => {
    it('queries that entity type and status inside the date window', () => {
      const request = buildTracesQueryRequest({ filters, withRootDuration: true, now });

      expect(request.timeRange).toEqual({ from: '2026-09-08T12:00:00.000Z', to: now.toISOString() });
      expect(request.where?.args).toContainEqual({
        op: 'eq',
        left: { path: 'entityType' },
        right: { literal: 'agent' },
      });
      expect(request.where?.args).toContainEqual({ op: 'eq', left: { path: 'status' }, right: { literal: 'error' } });
    });
  });

  describe('when the server supports root duration', () => {
    it('queries duration conditions in tokens and groups', () => {
      const body = JSON.stringify(buildTracesQueryRequest({ filters, withRootDuration: true, now }));

      expect(body.match(/durationMs/g)).toHaveLength(2);
    });
  });

  describe('when the server lacks root duration', () => {
    it('leaves duration conditions out of tokens and groups, keeping the rest of the group', () => {
      const body = JSON.stringify(buildTracesQueryRequest({ filters, withRootDuration: false, now }));

      expect(body).not.toContain('durationMs');
      expect(body).toContain('thread-1');
    });
  });
});

describe('buildTracesLegacyFilters', () => {
  describe('when the tokens select a root entity type, a status and a custom range', () => {
    it('maps them to the light list filters', () => {
      const dateFrom = new Date('2026-01-01T00:00:00.000Z');
      const dateTo = new Date('2026-01-02T00:00:00.000Z');
      const filters: TracesFilters = {
        ...baseFilters,
        datePreset: 'custom',
        dateFrom,
        dateTo,
        tokens: [
          { fieldId: 'rootEntityType', value: 'workflow_run' },
          { fieldId: 'status', value: 'success' },
        ],
      };

      expect(buildTracesLegacyFilters({ filters, dateFrom, dateTo })).toMatchObject({
        entityType: 'workflow_run',
        status: 'success',
        startedAt: { start: dateFrom },
        endedAt: { end: dateTo },
      });
    });
  });
});

describe('unsupportedTraceFilterReason', () => {
  const group: FilterBarGroup = {
    kind: 'group',
    id: 'g',
    logic: 'or',
    nodes: [{ id: 'n', fieldId: 'status', operatorId: 'is', value: 'error' }],
  };

  describe('when the server lists traces through the legacy endpoint', () => {
    const legacy = { withQueryTrace: false, withRootDuration: false };

    it('marks an AND/OR group, which that endpoint cannot run', () => {
      expect(unsupportedTraceFilterReason(group, legacy)).toBe(TRACE_FILTER_NOT_ON_THIS_STORAGE);
    });

    it('marks a field that endpoint does not filter on, and not one it does', () => {
      const item = { id: 'x', operatorId: 'is', value: 'llm' };
      expect(unsupportedTraceFilterReason({ ...item, fieldId: 'spans.name' }, legacy)).toBe(
        TRACE_FILTER_NOT_ON_THIS_STORAGE,
      );
      expect(unsupportedTraceFilterReason({ ...item, fieldId: 'runId' }, legacy)).toBeUndefined();
    });
  });

  describe('when the server has the trace query API', () => {
    it('runs AND/OR groups', () => {
      expect(unsupportedTraceFilterReason(group, { withQueryTrace: true, withRootDuration: false })).toBeUndefined();
    });
  });
});
