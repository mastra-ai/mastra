import type { KnowledgePageResponse, KnowledgeSequenceResponse } from '@mastra/client-js';

type Item = KnowledgeSequenceResponse['items'][number];

export const sequenceItem = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  sequenceId: 'general',
  externalId: id,
  title: null,
  body: id,
  links: [],
  properties: null,
  type: null,
  occurredAt: '2026-11-01T00:00:00.000Z',
  position: null,
  writtenAt: '2026-11-01T00:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  author: null,
  externalParentId: null,
  pageId: null,
  version: 1,
  writtenBy: 'importer:slack',
  ...extra,
});

export const timelineInfo: NonNullable<KnowledgePageResponse['sequence']> = {
  orderBy: 'timeline',
  propertiesSchema: null,
  itemTypes: null,
};

export const sequencePage = (ids: string[], nextCursor: string | null): KnowledgeSequenceResponse => ({
  items: ids.map(id => sequenceItem(id)),
  nextCursor,
});
