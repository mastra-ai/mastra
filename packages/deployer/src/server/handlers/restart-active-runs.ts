import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';

import { handleError } from './error';

export async function restartAllActiveWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    void mastra.restartAllActiveWorkflowRuns();

    return c.json({ message: 'Restarting all active workflow runs...' });
  } catch (error) {
    return handleError(error, 'Error restarting active workflow runs');
  }
}
