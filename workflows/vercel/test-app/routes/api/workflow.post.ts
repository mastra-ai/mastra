import { start } from 'workflow/api';
import { mainWorkflow } from '@mastra/vercel';

export default defineEventHandler(async event => {
  // Dynamic import from pre-built Mastra bundle - this initializes the singleton
  await import('../../.mastra/output/index.mjs');

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
