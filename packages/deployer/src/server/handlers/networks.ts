import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { handleError } from './error';
import { validateBody } from './utils';

// Network handlers
export async function getNetworksHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networks = mastra.getNetworks();

    const serializedNetworks = Object.entries(networks || {}).reduce<Record<string, any>>((acc, [_id, _network]) => {
      const network = _network as any;
      acc[_id] = {
        name: network.routingAgent.name,
        instructions: network.routingAgent.instructions,
        agents: network.agents.map((agent: any) => ({
          name: agent.name,
          provider: agent.llm?.getProvider(),
          modelId: agent.llm?.getModelId(),
        })),
        routingModel: {
          provider: network.routingAgent.llm?.getProvider(),
          modelId: network.routingAgent.llm?.getModelId(),
        },
        state: network.getState()?.state.toObject() || {},
      };
      return acc;
    }, {});

    return c.json(serializedNetworks);
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getNetworkByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const serializedNetwork = {
      name: network.routingAgent.name,
      instructions: network.routingAgent.instructions,
      agents: network.agents.map(agent => ({
        name: agent.name,
        instructions: agent.instructions,
        provider: agent.llm?.getProvider(),
        modelId: agent.llm?.getModelId(),
      })),
      routingModel: {
        provider: network.routingAgent.llm?.getProvider(),
        modelId: network.routingAgent.llm?.getModelId(),
      },
      state: network.getState()?.state.toObject() || {},
    };

    return c.json(serializedNetwork);
  } catch (error) {
    return handleError(error, 'Error getting network');
  }
}

export async function generateHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const { messages, threadId, resourceid, resourceId, output, runId, ...rest } = await c.req.json();
    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const result = await network.generate(messages, { threadId, resourceId: finalResourceId, output, runId, ...rest });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, threadId, resourceid, resourceId, output, runId, ...rest } = await c.req.json();

    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const streamResult = await network.stream(messages, {
      threadId,
      resourceId: finalResourceId,
      output,
      runId,
      ...rest,
    });

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
