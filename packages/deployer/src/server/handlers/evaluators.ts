import type { Mastra } from '@mastra/core';
import {
  getEvaluatorsHandler as getOriginalEvaluatorsHandler,
  executeEvaluatorHandler as executeOriginalEvaluatorHandler,
} from '@mastra/server/handlers/evaluators';
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

export async function executeEvaluatorHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const evaluatorId = c.req.param('evaluatorId');
    const { input, output, options } = await c.req.json();

    const result = await executeOriginalEvaluatorHandler({
      mastra,
      evaluatorId,
      input,
      output,
      options,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing evaluator');
  }
}
