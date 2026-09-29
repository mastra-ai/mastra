import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import type { SourceIndex } from '../workspaces/source-index.js';

export function createSourceSearchWorkflow(index: SourceIndex) {
  const searchInput = z.object({ question: z.string().trim().min(1).max(4_000) });
  const searchOutput = z.object({
    hits: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        score: z.number(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
    sources: z.array(
      z.object({
        sourceId: z.string(),
        ready: z.boolean(),
        stale: z.boolean(),
        lastSuccessAt: z.string().nullable(),
        error: z.string().nullable(),
        records: z.number(),
      }),
    ),
  });
  return createWorkflow({
    id: 'search-organization-records',
    options: { shouldPersistSnapshot: () => false },
    description: 'Searches indexed source evidence without generating an answer.',
    inputSchema: searchInput,
    outputSchema: searchOutput,
  })
    .then(
      createStep({
        id: 'search-indexed-records',
        inputSchema: searchInput,
        outputSchema: searchOutput,
        execute: async ({ inputData }) => ({
          hits: await index.search(inputData.question),
          sources: index.sourceStatus(),
        }),
      }),
    )
    .commit();
}
