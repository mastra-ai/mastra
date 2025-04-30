import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  getAgentCardByIdHandler as getOriginalAgentCardByIdHandler,
  getAgentExecutionHandler as getOriginalAgentExecutionHandler,
} from '@mastra/server/handlers/a2a';
import type { Context } from 'hono';

export async function getAgentCardByIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');

  const result = await getOriginalAgentCardByIdHandler({
    mastra,
    agentId,
    runtimeContext,
  });

  return c.json(result);
}

export async function getAgentExecutionHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');

  const result = await getOriginalAgentExecutionHandler({
    mastra,
    agentId,
    runtimeContext,
  });

  return c.json(result);
}
