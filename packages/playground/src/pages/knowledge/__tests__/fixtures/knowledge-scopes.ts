import type { KnowledgeScopesResponse } from '@mastra/client-js';

export const demoScopes: KnowledgeScopesResponse = {
  sets: [
    { scope: ['org:local', 'resource:studio-demo'], nodeCount: 10, recordCount: 20 },
    { scope: ['org:local', 'resource:studio-demo', 'team:LEE'], nodeCount: 43, recordCount: 55 },
    { scope: ['org:local', 'resource:studio-demo', 'team:MOB'], nodeCount: 5, recordCount: 17 },
  ],
  truncated: false,
};

export const noScopes: KnowledgeScopesResponse = { sets: [], truncated: false };
