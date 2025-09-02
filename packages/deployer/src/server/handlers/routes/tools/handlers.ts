import type { Mastra } from '@mastra/core';
import {
  getToolsHandler as getOriginalToolsHandler,
  getToolByIdHandler as getOriginalToolByIdHandler,
  executeToolHandler as getOriginalExecuteToolHandler,
  executeAgentToolHandler as getOriginalExecuteAgentToolHandler,
  getAgentToolHandler as getOriginalAgentToolHandler,
} from '@mastra/server/handlers/tools';
import type { Context } from 'hono';

import { handleError } from '../../error';

// Tool handlers
export async function getToolsHandler(c: Context) {
  try {
    const tools = c.get('tools');

    const result = await getOriginalToolsHandler({
      tools,
    });

    return c.json(result || {});
  } catch (error) {
    return handleError(error, 'Error getting tools');
  }
}

export async function getToolByIdHandler(c: Context) {
  try {
    const tools = c.get('tools');
    const toolId = c.req.param('toolId');

    const result = await getOriginalToolByIdHandler({
      tools,
      toolId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting tool');
  }
}

export function executeToolHandler(tools: Record<string, any>) {
  return async (c: Context) => {
    try {
      const mastra: Mastra = c.get('mastra');
      const runtimeContext = c.get('runtimeContext');
      const toolId = decodeURIComponent(c.req.param('toolId'));
      const runId = c.req.query('runId');
      const { data } = await c.req.json();

      const result = await getOriginalExecuteToolHandler(tools)({
        mastra,
        toolId,
        data,
        runtimeContext,
        runId,
      });

      return c.json(result);
    } catch (error) {
      return handleError(error, 'Error executing tool');
    }
  };
}

export async function getAgentToolHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const agentId = c.req.param('agentId');
    const toolId = c.req.param('toolId');

    const result = await getOriginalAgentToolHandler({
      mastra,
      agentId,
      toolId,
      runtimeContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting agent tool');
  }
}

export async function executeAgentToolHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const agentId = c.req.param('agentId');
    const toolId = c.req.param('toolId');
    const { data } = await c.req.json();

    const result = await getOriginalExecuteAgentToolHandler({
      mastra,
      agentId,
      toolId,
      data,
      runtimeContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing tool');
  }
}
