/**
 * Evented workflow for the resume-tracing test: one step that suspends until it is approved.
 * Both the API replica and the worker peer register this same workflow.
 */
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { z } from 'zod';

export function createApprovalWorkflow(id: string) {
  const approval = createStep({
    id: 'approval',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({}),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData?.approved) {
        await suspend({});
        return { approved: false };
      }
      return { approved: resumeData.approved };
    },
  });
  return createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.object({ approved: z.boolean() }) })
    .then(approval)
    .commit();
}

/** Ended spans are inserted whole, so a worker's end never has to find a row another process wrote. */
export function createResumeTracingObservability() {
  return new Observability({
    configs: {
      default: {
        serviceName: 'xproc-workflow-resume',
        exporters: [new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 })],
      },
    },
  });
}
