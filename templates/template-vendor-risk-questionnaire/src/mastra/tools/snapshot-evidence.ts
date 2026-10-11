import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { EvidenceExcerpt } from '../evidence/snapshot.ts';

export interface EvidenceAccess {
  search(query: string, topK?: number): Promise<Array<{ excerpt: EvidenceExcerpt; score: number }>>;
  read(id: string): Promise<EvidenceExcerpt>;
}

export function createSnapshotEvidenceTools(evidence: EvidenceAccess) {
  return Object.freeze({
    evidence_search: createTool({
      id: 'evidence_search',
      description:
        'Search only this run’s approved LLM-permitted evidence excerpts. Scores rank retrieval and are not confidence probabilities.',
      inputSchema: z
        .object({ query: z.string().min(1).max(1000), topK: z.int().positive().max(10).default(5) })
        .strict(),
      execute: async input => evidence.search(input.query, input.topK),
    }),
    evidence_read: createTool({
      id: 'evidence_read',
      description:
        'Read an eligible excerpt by an exact ID returned from evidence search. No path, URL or mutation arguments are accepted.',
      inputSchema: z.object({ id: z.string().min(1).max(240) }).strict(),
      execute: async input => evidence.read(input.id),
    }),
  });
}
