import { Context } from 'hono';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';
import { validateBody } from './utils';

// Agent handlers
export async function getAgentsHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
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
        ...agent,
        tools: serializedAgentTools,
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
    const mastra = c.get('mastra');
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
      ...agent,
      tools: serializedAgentTools,
    });
  } catch (error) {
    return handleError(error, 'Error getting agent');
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

    const { messages, threadId, resourceid, output } = await c.req.json();
    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    const result = await agent.generate(messages, { threadId, resourceid, output });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler(c: Context) {
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

    const streamResult = await agent.stream(messages, { threadId, resourceid, output });

    return new Response(streamResult.toDataStream(), {
      headers: {
        'Content-Type': 'text/x-unknown',
        'content-encoding': 'identity',
        'transfer-encoding': 'chunked',
      },
    });
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}
