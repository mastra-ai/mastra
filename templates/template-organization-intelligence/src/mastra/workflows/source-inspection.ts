import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import type { SourceRuntime } from '../workspaces/sources.js';

const inspectionInput = z.object({ sourceId: z.string().min(1), path: z.string().min(1) });
const inspectionOutput = z.object({
  sourceId: z.string(),
  mountPath: z.string(),
  status: z.enum(['available', 'configured', 'unavailable']),
  content: z.string().optional(),
  error: z.string().optional(),
});

export function createSourceInspectionWorkflow(runtime: SourceRuntime) {
  const inspectSource = createStep({
    id: 'inspect-source-record',
    inputSchema: inspectionInput,
    outputSchema: inspectionOutput,
    execute: async ({ inputData }) => runtime.inspect(inputData.sourceId, inputData.path),
  });

  return createWorkflow({
    id: 'inspect-organization-source',
    options: { shouldPersistSnapshot: () => false },
    description: 'Reads one configured source record without indexing, generation, or source mutation.',
    inputSchema: inspectionInput,
    outputSchema: inspectionOutput,
  })
    .then(inspectSource)
    .commit();
}
