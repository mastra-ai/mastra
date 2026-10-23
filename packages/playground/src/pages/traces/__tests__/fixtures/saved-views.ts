import type { ListSavedViewsResponse, SavedViewResponse } from '@mastra/client-js';
import type { FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import type { TraceViewSettings } from '@mastra/playground-ui/domains/traces/trace-saved-views';

export const emptySavedViews: ListSavedViewsResponse = {
  views: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};

const errorsFilters: FilterBarItem[] = [{ id: 'status', fieldId: 'status', operatorId: 'is', value: 'error' }];
const errorsSettings: TraceViewSettings = {
  datePreset: 'last-24h',
  groups: [],
  sortDirection: 'asc',
  columns: {
    visibleColumns: ['type', 'duration'],
    customColumns: [],
    metadataKeys: [],
    order: ['startTime', 'type', 'name', 'status', 'duration'],
  },
};

/** Errors in the last 24 hours, oldest first, with only the type and duration columns. */
export const errorsView: SavedViewResponse = {
  id: 'view-errors',
  page: 'traces',
  name: 'Errors',
  authorId: null,
  updatedById: null,
  state: { version: 1, filters: errorsFilters, settings: errorsSettings },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const productionOrStagingFilters: FilterBarItem[] = [
  { id: 'status', fieldId: 'status', operatorId: 'is', value: 'success' },
];
const productionOrStagingSettings: TraceViewSettings = {
  datePreset: 'last-7d',
  groups: [
    {
      id: 'envs',
      logic: 'or',
      nodes: [
        { id: 'envs-production', fieldId: 'environment', value: 'production' },
        { id: 'envs-staging', fieldId: 'environment', value: 'staging' },
      ],
    },
  ],
  sortDirection: 'desc',
  columns: { visibleColumns: ['type', 'input', 'duration'], customColumns: [], metadataKeys: [], order: [] },
};

/** A view with one plain filter and one advanced (OR) filter. */
export const productionOrStagingView: SavedViewResponse = {
  id: 'view-envs',
  page: 'traces',
  name: 'Prod or staging',
  authorId: 'user-1',
  updatedById: 'user-1',
  state: { version: 1, filters: productionOrStagingFilters, settings: productionOrStagingSettings },
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

export const savedViewsList = (...views: SavedViewResponse[]): ListSavedViewsResponse => ({
  views,
  pagination: { total: views.length, page: 0, perPage: 100, hasMore: false },
});
