import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { handleError } from './error';
import { validateBody } from './utils';

export async function getNetworksHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networks = mastra.getNetworks();

    const serializedNetworks = networks.map(network => {
      const routingAgent = network.getRoutingAgent();
      const agents = network.getAgents();
      return {
        id: network.formatAgentId(routingAgent.name),
        name: routingAgent.name,
        instructions: routingAgent.instructions,
        agents: agents.map(agent => ({
          name: agent.name,
          provider: agent.llm?.getProvider(),
          modelId: agent.llm?.getModelId(),
        })),
        routingModel: {
          provider: routingAgent.llm?.getProvider(),
          modelId: routingAgent.llm?.getModelId(),
        },
      };
    });

    return c.json(serializedNetworks);
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getNetworkByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const networks = mastra.getNetworks();

    const network = networks.find(network => {
      const routingAgent = network.getRoutingAgent();
      return network.formatAgentId(routingAgent.name) === networkId;
    });

    if (!network) {
      return c.json({ error: 'Network not found' }, 404);
    }

    const routingAgent = network.getRoutingAgent();
    const agents = network.getAgents();

    const serializedNetwork = {
      id: network.formatAgentId(routingAgent.name),
      name: routingAgent.name,
      instructions: routingAgent.instructions,
      agents: agents.map(agent => ({
        name: agent.name,
        provider: agent.llm?.getProvider(),
        modelId: agent.llm?.getModelId(),
      })),
      routingModel: {
        provider: routingAgent.llm?.getProvider(),
        modelId: routingAgent.llm?.getModelId(),
      },
    };

    return c.json(serializedNetwork);
  } catch (error) {
    return handleError(error, 'Error getting network by ID');
  }
}

export async function generateHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const { messages, threadId, resourceid, resourceId, output, runId, ...rest } = await c.req.json();
    validateBody({ messages });

    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const result = await network.generate(messages, { threadId, resourceId: finalResourceId, output, runId, ...rest });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from network');
  }
}

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const { messages, threadId, resourceid, resourceId, output, runId, ...rest } = await c.req.json();

    validateBody({ messages });

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
    return handleError(error, 'Error streaming from network');
  }
}
