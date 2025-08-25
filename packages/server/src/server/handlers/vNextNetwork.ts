import type { RuntimeContext } from '@mastra/core/runtime-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { handleError } from './error';
import { validateBody } from './utils';

interface NetworkContext extends Context {
  networkId?: string;
  runtimeContext: RuntimeContext;
}

export async function getVNextNetworksHandler({
  mastra,
  runtimeContext,
}: Pick<NetworkContext, 'mastra' | 'runtimeContext'>) {
  try {
    const networks = mastra.vnext_getNetworks();

    const serializedNetworks = await Promise.all(
      networks.map(async network => {
        const routingAgent = await network.getRoutingAgent({ runtimeContext });
        const routingLLM = await routingAgent.getLLM({ runtimeContext });
        const agents = await network.getAgents({ runtimeContext });
        const workflows = await network.getWorkflows({ runtimeContext });
        const tools = await network.getTools({ runtimeContext });
        const networkInstruction = await network.getInstructions({ runtimeContext });
        return {
          id: network.id,
          name: network.name,
          instructions: networkInstruction,
          tools: await Promise.all(
            Object.values(tools).map(async tool => {
              return {
                id: tool.id,
                description: tool.description,
              };
            }),
          ),
          agents: await Promise.all(
            Object.values(agents).map(async agent => {
              const llm = await agent.getLLM({ runtimeContext });
              return {
                name: agent.name,
                provider: llm?.getProvider(),
                modelId: llm?.getModelId(),
              };
            }),
          ),
          workflows: await Promise.all(
            Object.values(workflows).map(async workflow => {
              return {
                name: workflow.name,
                description: workflow.description,
                inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
                outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
              };
            }),
          ),
          routingModel: {
            provider: routingLLM?.getProvider(),
            modelId: routingLLM?.getModelId(),
          },
        };
      }),
    );

    return serializedNetworks;
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getVNextNetworkByIdHandler({
  mastra,
  networkId,
  runtimeContext,
}: Pick<NetworkContext, 'mastra' | 'networkId' | 'runtimeContext'>) {
  try {
    const network = mastra.vnext_getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const routingAgent = await network.getRoutingAgent({ runtimeContext });
    const routingLLM = await routingAgent.getLLM({ runtimeContext });
    const agents = await network.getAgents({ runtimeContext });
    const workflows = await network.getWorkflows({ runtimeContext });
    const tools = await network.getTools({ runtimeContext });
    const networkInstruction = await network.getInstructions({ runtimeContext });
    const serializedNetwork = {
      id: network.id,
      name: network.name,
      instructions: networkInstruction,
      agents: await Promise.all(
        Object.values(agents).map(async agent => {
          const llm = await agent.getLLM({ runtimeContext });
          return {
            name: agent.name,
            provider: llm?.getProvider(),
            modelId: llm?.getModelId(),
          };
        }),
      ),
      workflows: await Promise.all(
        Object.values(workflows).map(async workflow => {
          return {
            name: workflow.name,
            description: workflow.description,
            inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
            outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
          };
        }),
      ),
      tools: await Promise.all(
        Object.values(tools).map(async tool => {
          return {
            id: tool.id,
            description: tool.description,
          };
        }),
      ),
      routingModel: {
        provider: routingLLM?.getProvider(),
        modelId: routingLLM?.getModelId(),
      },
    };

    return serializedNetwork;
  } catch (error) {
    return handleError(error, 'Error getting network by ID');
  }
}

export async function generateVNextNetworkHandler({
  mastra,
  runtimeContext,
  networkId,
  body,
}: NetworkContext & {
  runtimeContext: RuntimeContext;
  body: { message: string; threadId?: string; resourceId?: string };
}) {
  try {
    const network = mastra.vnext_getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    validateBody({ message: body.message });

    const { message, threadId, resourceId } = body;
    const result = await network.generate(message, { runtimeContext, threadId, resourceId });

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from network');
  }
}

export async function streamGenerateVNextNetworkHandler({
  mastra,
  networkId,
  body,
  runtimeContext,
}: NetworkContext & {
  runtimeContext: RuntimeContext;
  body: { message: string; threadId?: string; resourceId?: string };
}) {
  try {
    const network = mastra.vnext_getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    validateBody({ message: body.message });

    const { message, threadId, resourceId } = body;
    const streamResult = await network.stream(message, {
      runtimeContext,
      threadId,
      resourceId,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'Error streaming from network');
  }
}

export async function loopVNextNetworkHandler({
  mastra,
  networkId,
  body,
  runtimeContext,
}: NetworkContext & {
  runtimeContext: RuntimeContext;
  body: { message: string };
}) {
  try {
    const network = mastra.vnext_getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    validateBody({ message: body.message });

    const { message } = body;
    const result = await network.loop(message, {
      runtimeContext,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error looping network');
  }
}

export async function loopStreamVNextNetworkHandler({
  mastra,
  networkId,
  body,
  runtimeContext,
}: NetworkContext & {
  runtimeContext: RuntimeContext;
  body: { message: string; threadId?: string; resourceId?: string; maxIterations?: number };
}) {
  try {
    const network = mastra.vnext_getNetwork(networkId!);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    validateBody({ message: body.message });

    const { message, threadId, resourceId, maxIterations } = body;
    const result = await network.loopStream(message, {
      runtimeContext,
      threadId,
      resourceId,
      maxIterations,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error streaming network loop');
  }
}
