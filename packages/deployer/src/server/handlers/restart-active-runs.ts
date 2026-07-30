import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';

import { handleError } from './error';

export async function restartAllActiveWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    void mastra.restartAllActiveWorkflowRuns().catch(error => {
      mastra.getLogger().error('Failed to restart active workflow runs during server startup', { error });
    });

    // Opt-in boot-time recovery for orphaned RUNNING durable-agent runs.
    // Gated by `recovery.durableAgents === 'auto'` so we don't silently
    // re-issue LLM calls / re-execute tools on restart.
    if (mastra.recoveryConfig?.durableAgents === 'auto') {
      void mastra.recoverAllDurableAgents().catch(error => {
        mastra.getLogger().error('Failed to recover durable agent runs during server startup', { error });
      });
    }

    return c.json({ message: 'Restarting all active workflow runs...' });
  } catch (error) {
    return handleError(error, 'Error restarting active workflow runs');
  }
}
