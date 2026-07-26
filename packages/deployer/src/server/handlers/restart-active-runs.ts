import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';

import { handleError } from './error';

export async function restartAllActiveWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    void mastra.restartAllActiveWorkflowRuns();

    // Opt-in boot-time recovery for orphaned RUNNING durable-agent runs.
    // Gated by `recovery.durableAgents === 'auto'` so we don't silently
    // re-issue LLM calls / re-execute tools on restart.
    if (mastra.recoveryConfig?.durableAgents === 'auto') {
      void mastra.recoverAllDurableAgents();
    }

    return c.json({ message: 'Restarting all active workflow runs...' });
  } catch (error) {
    return handleError(error, 'Error restarting active workflow runs');
  }
}
