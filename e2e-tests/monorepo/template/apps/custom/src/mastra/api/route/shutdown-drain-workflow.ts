import { registerApiRoute } from '@mastra/core/server';

// Starts an evented workflow run without awaiting it, so the run is still
// in flight when the E2E test sends SIGTERM. Returning immediately also means
// there is no open HTTP connection for the server's request drain to wait on;
// only `mastra.shutdown()`'s evented run drain keeps the run alive.
export const shutdownDrainWorkflowRoute = registerApiRoute('/shutdown-drain-workflow', {
  method: 'POST',
  handler: async c => {
    const mastra = c.get('mastra');
    const run = await mastra.getWorkflow('shutdownDrainWorkflow').createRun();
    void run.start({ inputData: {} });
    return c.json({ runId: run.runId });
  },
});
