import type { AgentNetwork } from '@mastra/core/network';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { handleError } from './error';
import { validateBody } from './utils';

interface NetworkContext extends Context {
  networkId?: string;
}

export async function getNetworksHandler({ mastra }: Pick<NetworkContext, 'mastra'>) {
  try {
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

    return serializedNetworks;
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getNetworkByIdHandler({ mastra, networkId }: Pick<NetworkContext, 'mastra' | 'networkId'>) {
  try {
    const networks = mastra.getNetworks();

    const network = networks.find(network => {
      const routingAgent = network.getRoutingAgent();
      return network.formatAgentId(routingAgent.name) === networkId;
    });

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
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

    return serializedNetwork;
  } catch (error) {
    return handleError(error, 'Error getting network by ID');
  }
}

export async function generateHandler({
  mastra,
  networkId,
  body,
}: NetworkContext & {
  body: { messages?: Parameters<AgentNetwork['generate']>[0] } & Parameters<AgentNetwork['generate']>[1];
}) {
  try {
    const network = mastra.getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    validateBody({ messages: body.messages });

    const { messages, ...rest } = body;
    const result = await network.generate(messages!, rest);

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from network');
  }
}

export async function streamGenerateHandler({
  mastra,
  networkId,
  body,
}: NetworkContext & {
  body: { messages?: Parameters<AgentNetwork['stream']>[0] } & Parameters<AgentNetwork['stream']>[1];
}) {
  try {
    const network = mastra.getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    validateBody({ messages: body.messages });

    const { messages, output, ...rest } = body;
    const streamResult = await network.stream(messages!, {
      output: output as any,
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
