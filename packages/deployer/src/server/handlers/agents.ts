import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { readFile } from 'fs/promises';
import { HTTPException } from 'hono/http-exception';

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
    });
  } catch (error) {
    return handleError(error, 'Error getting agent');
  }
}

export async function getEvalsByAgentIdHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);
    const evals = await readFile('./evals.json', 'utf-8');
    const parsedEvals = evals
      .split('\n')
      .map(line => line && JSON.parse(line))
      .filter((line: any) => line?.meta?.agentName === agent.name);
    return c.json({
      ...agent,
      evals: parsedEvals,
    });
  } catch (error) {
    return handleError(error, 'Error getting evals');
  }
}

export function getLiveEvalsByAgentIdHandler(evalStore: any) {
  return async (c: Context) => {
    try {
      const mastra = c.get('mastra');
      const agentId = c.req.param('agentId');
      const agent = mastra.getAgent(agentId);
      const evals = (await mastra?.memory?.storage?.getEvalsByAgentName(agent.name)) || [];

      return c.json({
        ...agent,
        evals,
      });
    } catch (error) {
      return handleError(error, 'Error getting evals');
    }
  };
}

export async function generateHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, threadId, resourceid, output } = await c.req.json();
    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    const result = await agent.generate(messages, { threadId, resourceId: resourceid, output });

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

    const { messages, threadId, resourceid, output } = await c.req.json();

    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    const streamResult = await agent.stream(messages, { threadId, resourceId: resourceid, output });

    const streamResponse = output
      ? streamResult.toTextStreamResponse()
      : streamResult.toDataStreamResponse({
          sendUsage: true,
          sendReasoning: true,
          getErrorMessage: (error: any) => {
            return `An error occurred while processing your request. ${error}`;
          },
        });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}
