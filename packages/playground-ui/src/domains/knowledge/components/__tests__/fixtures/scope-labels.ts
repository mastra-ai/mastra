import type { KnowledgeGraphResponse } from '@mastra/client-js';

import pages from './scope-labels.json';

// Captured from real LibSQL-backed Factory Knowledge routes for #30846.
export const scopeLabelsGraph = {
  pages,
  edges: [],
  pinnedIds: [],
  truncated: false,
} satisfies KnowledgeGraphResponse;

export const labeledScopeGraph = {
  ...scopeLabelsGraph,
  pages: [
    {
      id: 'org',
      scopeId: 'org',
      parentId: null,
      isScope: true,
      position: 'a0',
      name: 'org:acme',
      address: 'org:acme',
      displayLabel: 'Acme',
      version: 1,
      createdBy: { author: 'host' },
      updatedBy: { author: 'host' },
      createdAt: '2026-10-28T00:00:00.000Z',
      updatedAt: '2026-10-28T00:00:00.000Z',
    },
  ],
} satisfies KnowledgeGraphResponse;

export const emptyScopeGraph = {
  ...labeledScopeGraph,
  pages: labeledScopeGraph.pages.map(page => ({
    ...page,
    id: 'empty',
    scopeId: 'empty',
    name: 'empty',
    address: 'project:empty',
    displayLabel: undefined,
  })),
} satisfies KnowledgeGraphResponse;
