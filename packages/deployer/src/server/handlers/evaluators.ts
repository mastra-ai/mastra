import type { Mastra } from '@mastra/core';
import { getEvaluatorsHandler as getOriginalEvaluatorsHandler } from '@mastra/server/handlers';
import type { Context } from 'hono';
import { handleError } from './error';

export async function getEvaluatorsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const result = await getOriginalEvaluatorsHandler({ mastra });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting evaluators');
  }
}
