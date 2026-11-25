import { registerApiRoute } from '@mastra/core/server';
import { shutdownThreadToolStarted } from '@/agents/shutdown-thread-agent';

// Starts an agent run on a memory thread and returns once its tool is executing, so
// the run is still holding its thread when the E2E test sends SIGTERM.
export const shutdownThreadRunRoute = registerApiRoute('/shutdown-thread-run', {
  method: 'POST',
  handler: async c => {
    const output = await c
      .get('mastra')
      .getAgent('shutdownThreadAgent')
      .stream('go', { memory: { thread: 'shutdown-thread', resource: 'e2e' }, maxSteps: 2 });
    void output.consumeStream().catch(() => {});
    await shutdownThreadToolStarted;
    return c.json({ runId: output.runId });
  },
});
