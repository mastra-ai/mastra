import type { KnowledgeSequenceResponse } from '@mastra/client-js';

export const sequenceItem = (id: string): KnowledgeSequenceResponse['items'][number] => ({
  id,
  sequenceId: 'general',
  externalId: id,
  body: id,
  occurredAt: '2026-11-01T00:00:00.000Z',
  writtenAt: '2026-11-01T00:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  author: null,
  externalParentId: null,
  version: 1,
  writtenBy: 'importer:slack',
});

export const sequencePage = (ids: string[], nextCursor: string | null): KnowledgeSequenceResponse => ({
  items: ids.map(sequenceItem),
  nextCursor,
});
