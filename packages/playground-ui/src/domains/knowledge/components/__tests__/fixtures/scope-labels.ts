import type { KnowledgeGraphResponse } from '@mastra/client-js';

import pages from './scope-labels.json';

// Captured from real LibSQL-backed Factory Knowledge routes for #30846.
export const scopeLabelsGraph = {
  pages,
  edges: [],
  pinnedIds: [],
  truncated: false,
} satisfies KnowledgeGraphResponse;
