import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { z } from 'zod';

export const SHUTDOWN_DRAIN_WORKFLOW_MARKER = 'shutdown-drain-workflow:finished';

const slowStep = createStep({
  id: 'slow-step',
  inputSchema: z.object({}),
  outputSchema: z.object({ done: z.boolean() }),
  execute: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // The E2E test watches the server's stdout for this marker to prove the
    // in-flight evented run finished before the process exited on SIGTERM.
    console.log(SHUTDOWN_DRAIN_WORKFLOW_MARKER);
    return { done: true };
  },
});

export const shutdownDrainWorkflow = createWorkflow({
  id: 'shutdown-drain-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({ done: z.boolean() }),
})
  .then(slowStep)
  .commit();
