import type { KnowledgeTimelineResponse } from '@mastra/client-js';

export const timelineEntry = (id: string): KnowledgeTimelineResponse['entries'][number] => ({
  id,
  timelineId: 'general',
  externalId: id,
  body: id,
  occurredAt: '2026-11-01T00:00:00.000Z',
  writtenAt: '2026-11-01T00:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  author: null,
  threadExternalId: null,
  version: 1,
  writtenBy: 'importer:slack',
});

export const timelinePage = (ids: string[], nextCursor: string | null): KnowledgeTimelineResponse => ({
  entries: ids.map(timelineEntry),
  nextCursor,
});
