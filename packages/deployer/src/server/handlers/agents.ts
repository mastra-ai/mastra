import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { handleError } from './error';
import { validateBody } from './utils';

// Agent handlers
export async function getAgentsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agents = mastra.getAgents();

    const serializedAgents = Object.entries(agents).reduce<any>((acc, [_id, _agent]) => {
      const agent = _agent as any;
      const serializedAgentTools = Object.entries(agent?.tools || {}).reduce<any>((acc, [key, tool]) => {
        const _tool = tool as any;
        acc[key] = {
          ..._tool,
          inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
          outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
        };
        return acc;
      }, {});
      acc[_id] = {
        name: agent.name,
        instructions: agent.instructions,
        tools: serializedAgentTools,
        provider: agent.llm?.getProvider(),
        modelId: agent.llm?.getModelId(),
      };
      return acc;
    }, {});

    return c.json(serializedAgents);
  } catch (error) {
    return handleError(error, 'Error getting agents');
  }
}

export async function getAgentByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const serializedAgentTools = Object.entries(agent?.tools || {}).reduce<any>((acc, [key, tool]) => {
      const _tool = tool as any;
      acc[key] = {
        ..._tool,
        inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
        outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
      };
      return acc;
    }, {});

    return c.json({
      name: agent.name,
      instructions: agent.instructions,
      tools: serializedAgentTools,
      provider: agent.llm?.getProvider(),
      modelId: agent.llm?.getModelId(),
    });
  } catch (error) {
    return handleError(error, 'Error getting agent');
  }
}

export async function getEvalsByAgentIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);
    const evals = (await mastra.storage?.getEvalsByAgentName?.(agent.name, 'test')) || [];
    return c.json({
      id: agentId,
      name: agent.name,
      instructions: agent.instructions,
      evals,
    });
  } catch (error) {
    return handleError(error, 'Error getting test evals');
  }
}

export async function getLiveEvalsByAgentIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);
    const evals = (await mastra.storage?.getEvalsByAgentName?.(agent.name, 'live')) || [];

    return c.json({
      id: agentId,
      name: agent.name,
      instructions: agent.instructions,
      evals,
    });
  } catch (error) {
    return handleError(error, 'Error getting live evals');
  }
}

export async function generateHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, threadId, resourceid, resourceId, output, runId } = await c.req.json();
    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const result = await agent.generate(messages, { threadId, resourceId: finalResourceId, output, runId });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, threadId, resourceid, resourceId, output, runId } = await c.req.json();

    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const streamResult = await agent.stream(messages, { threadId, resourceId: finalResourceId, output, runId });

    const streamResponse = output
      ? streamResult.toTextStreamResponse()
      : streamResult.toDataStreamResponse({
          sendUsage: true,
          sendReasoning: true,
          getErrorMessage: (error: any) => {
            return `An error occurred while processing your request. ${error instanceof Error ? error.message : JSON.stringify(error)}`;
          },
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
