import { start } from 'workflow/api';
import { mainWorkflow } from '../../../src/runtime.workflow';

export default defineEventHandler(async event => {
  // Dynamic import to avoid static analysis of @mastra/core
  const { ensureMastraSetup } = await import('../../setup');
  ensureMastraSetup();

  const body = await readBody(event);
  console.log('[api/workflow] Received request:', body);

  try {
    const result = await start(mainWorkflow, [body]);
    console.log('[api/workflow] Result:', result);
    return result;
  } catch (error) {
    console.error('[api/workflow] Error:', error);
    throw error;
  }
});
