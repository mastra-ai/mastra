import type { ListSavedViewsResponse, SavedViewResponse } from '@mastra/client-js';

export const emptySavedViews: ListSavedViewsResponse = {
  views: [],
  pagination: { total: 0, page: 0, perPage: false, hasMore: false },
};

/** Errors in the last 24 hours, oldest first, with the Input column hidden. */
export const errorsView: SavedViewResponse = {
  id: 'view-errors',
  page: 'traces',
  name: 'Errors',
  authorId: null,
  state: {
    version: 1,
    timeRange: { preset: 'last-24h' },
    filter: { logic: 'and', nodes: [{ fieldId: 'status', operatorId: 'is', value: 'error' }] },
    sort: { field: 'startedAt', direction: 'asc' },
    columns: { visibleColumns: ['type', 'duration'], customColumns: [], metadataKeys: [] },
    columnOrder: ['startTime', 'type', 'name', 'status', 'duration'],
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

/** A view with one plain filter and one advanced (OR) filter. */
export const productionOrStagingView: SavedViewResponse = {
  id: 'view-envs',
  page: 'traces',
  name: 'Prod or staging',
  authorId: 'user-1',
  state: {
    version: 1,
    timeRange: { preset: 'last-7d' },
    filter: {
      logic: 'and',
      nodes: [
        { fieldId: 'status', operatorId: 'is', value: 'success' },
        {
          kind: 'group',
          logic: 'or',
          nodes: [
            { fieldId: 'environment', operatorId: 'is', value: 'production' },
            { fieldId: 'environment', operatorId: 'is', value: 'staging' },
          ],
        },
      ],
    },
    sort: { field: 'startedAt', direction: 'desc' },
    columns: { visibleColumns: ['type', 'input', 'duration', 'estimatedCost'], customColumns: [], metadataKeys: [] },
    columnOrder: [],
  },
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

export const savedViewsList = (...views: SavedViewResponse[]): ListSavedViewsResponse => ({
  views,
  pagination: { total: views.length, page: 0, perPage: false, hasMore: false },
});
