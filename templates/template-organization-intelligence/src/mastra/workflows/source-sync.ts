import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import type { SourceIndex } from '../workspaces/source-index.js';

const input = z.object({ trigger: z.enum(['startup', 'manual', 'scheduled']).default('manual') });
const output = z.object({
  runId: z.string(),
  status: z.enum(['success', 'partial', 'failed', 'skipped']),
  startedAt: z.string(),
  finishedAt: z.string(),
  sources: z.array(
    z.object({
      sourceId: z.string(),
      discovered: z.number(),
      indexed: z.number(),
      changed: z.number(),
      unchanged: z.number(),
      skipped: z.number(),
      failed: z.number(),
      removed: z.number(),
      status: z.enum(['success', 'partial', 'failed']),
      errors: z.array(z.string()),
    }),
  ),
});

export function createSourceSyncWorkflow(index: SourceIndex) {
  const sync = createStep({
    id: 'sync-organization-sources',
    inputSchema: input,
    outputSchema: output,
    execute: async () => index.sync(),
  });
  return createWorkflow({
    id: 'sync-organization-sources',
    options: { autoRestartActiveRuns: false, shouldPersistSnapshot: () => false },
    description: 'Refreshes configured sources and reports indexed, changed, skipped and failed records.',
    inputSchema: input,
    outputSchema: output,
    schedule: { cron: '*/5 * * * *', timezone: 'UTC', inputData: { trigger: 'scheduled' } },
  })
    .then(sync)
    .commit();
}
