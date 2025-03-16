import type { Mastra } from '@mastra/core';

import type { Context } from 'hono';
import { handleError } from './error';

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
