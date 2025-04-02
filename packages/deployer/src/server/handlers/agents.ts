import type { Mastra } from '@mastra/core';
import {
  getAgentsHandler as getOriginalAgentsHandler,
  getAgentByIdHandler as getOriginalAgentByIdHandler,
  getEvalsByAgentIdHandler as getOriginalEvalsByAgentIdHandler,
  getLiveEvalsByAgentIdHandler as getOriginalLiveEvalsByAgentIdHandler,
  generateHandler as getOriginalGenerateHandler,
  streamGenerateHandler as getOriginalStreamGenerateHandler,
} from '@mastra/server/handlers/agents';
import type { Context } from 'hono';

import { handleError } from './error';

// Agent handlers
export async function getAgentsHandler(c: Context) {
  const serializedAgents = await getOriginalAgentsHandler({ mastra: c.get('mastra') });

  return c.json(serializedAgents);
}

export async function getAgentByIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');

  const result = await getOriginalAgentByIdHandler({
    mastra,
    agentId,
  });

  return c.json(result);
}

export async function getEvalsByAgentIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');

  const result = await getOriginalEvalsByAgentIdHandler({
    mastra,
    agentId,
  });

  return c.json(result);
}

export async function getLiveEvalsByAgentIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');

  const result = await getOriginalLiveEvalsByAgentIdHandler({
    mastra,
    agentId,
  });

  return c.json(result);
}

export async function generateHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const body = await c.req.json();

    const result = await getOriginalGenerateHandler({
      mastra,
      agentId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamGenerateHandler({
      mastra,
      agentId,
      body,
    });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}

export async function setAgentInstructionsHandler(c: Context) {
  try {
    // Check if this is a playground request
    const isPlayground = c.get('playground') === true;
    if (!isPlayground) {
      return c.json({ error: 'This API is only available in the playground environment' }, 403);
    }

    const agentId = c.req.param('agentId');
    const { instructions } = await c.req.json();

    if (!agentId || !instructions) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const mastra: Mastra = c.get('mastra');
    const agent = mastra.getAgent(agentId);
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    agent.__updateInstructions(instructions);

    return c.json(
      {
        instructions,
      },
      200,
    );
  } catch (error) {
    return handleError(error, 'Error setting agent instructions');
  }
}
