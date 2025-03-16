import type { Mastra } from '@mastra/core';

import type { Context } from 'hono';
import { handleError } from './error';

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
