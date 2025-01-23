import { Context } from 'hono';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';
import { validateBody } from './utils';

// Tool handlers
export async function getToolsHandler(c: Context) {
  try {
    const tools = c.get('tools');

    if (!tools) {
      return c.json({});
    }

    const serializedTools = Object.entries(tools).reduce(
      (acc, [id, _tool]) => {
        const tool = _tool as any;
        acc[id] = {
          ...tool,
          inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
          outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    return c.json(serializedTools);
  } catch (error) {
    return handleError(error, 'Error getting tools');
  }
}

export async function getToolByIdHandler(c: Context) {
  try {
    const tools = c.get('tools');
    const toolId = c.req.param('toolId');
    const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;

    if (!tool) {
      throw new HTTPException(404, { message: 'Tool not found' });
    }

    const serializedTool = {
      ...tool,
      inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
      outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
    };

    return c.json(serializedTool);
  } catch (error) {
    return handleError(error, 'Error getting tool');
  }
}

export async function getToolResultHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const memory = mastra.memory;
    const threadId = c.req.param('threadId');
    const { toolName, toolArgs } = await c.req.json();

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ toolName, toolArgs });

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    const result = await memory.getToolResult({ threadId, toolName, toolArgs });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting tool result');
  }
}

export async function validateToolCallArgsHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const memory = mastra.memory;
    const { hashedArgs } = await c.req.json();

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ hashedArgs });

    const result = await memory.validateToolCallArgs({ hashedArgs });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error validating tool call args');
  }
}

export function executeToolHandler(tools: Record<string, any>) {
  return async (c: Context) => {
    try {
      const toolId = decodeURIComponent(c.req.param('toolId'));
      const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        return c.json({ error: 'Tool not found' }, 404);
      }

      const { input } = await c.req.json();
      const mastra = c.get('mastra');
      const result = await tool.execute({
        context: {
          ...input,
        },
        mastra,
        runId: mastra.runId,
      });

      return c.json(result);
    } catch (error) {
      return handleError(error, 'Error executing tool');
    }
  };
}

export async function executeAgentToolHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const toolId = c.req.param('toolId');
    const agent = mastra.getAgent(agentId);
    const tool = Object.values(agent?.tools || {}).find((tool: any) => tool.id === toolId) as any;

    if (!tool) {
      throw new HTTPException(404, { message: 'Tool not found' });
    }

    const body = await c.req.json();
    const result = await tool.execute({
      context: {
        ...body,
      },
      mastra,
      runId: agentId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing tool');
  }
}
