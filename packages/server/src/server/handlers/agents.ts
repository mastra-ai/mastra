import type { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

type GetBody<
  T extends keyof Agent & { [K in keyof Agent]: Agent[K] extends (...args: any) => any ? K : never }[keyof Agent],
> = {
  messages: Parameters<Agent[T]>[0];
} & Parameters<Agent[T]>[1];

// Agent handlers
export async function getAgentsHandler({ mastra, runtimeContext }: Context & { runtimeContext: RuntimeContext }) {
  try {
    const agents = mastra.getAgents();

    const serializedAgentsMap = await Promise.all(
      Object.entries(agents).map(async ([id, agent]) => {
        const instructions = await agent.getInstructions({ runtimeContext });
        const tools = await agent.getTools({ runtimeContext });
        const llm = await agent.getLLM({ runtimeContext });

        const serializedAgentTools = Object.entries(tools || {}).reduce<any>((acc, [key, tool]) => {
          const _tool = tool as any;
          acc[key] = {
            ..._tool,
            inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
            outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
          };
          return acc;
        }, {});

        return {
          id,
          name: agent.name,
          instructions,
          tools: serializedAgentTools,
          provider: llm?.getProvider(),
          modelId: llm?.getModelId(),
        };
      }),
    );

    const serializedAgents = serializedAgentsMap.reduce<any>((acc, { id, ...rest }) => {
      acc[id] = rest;
      return acc;
    }, {});

    return serializedAgents;
  } catch (error) {
    return handleError(error, 'Error getting agents');
  }
}

export async function getAgentByIdHandler({
  mastra,
  runtimeContext,
  agentId,
}: Context & { runtimeContext: RuntimeContext; agentId: string }) {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const tools = await agent.getTools({ runtimeContext });

    const serializedAgentTools = Object.entries(tools || {}).reduce<any>((acc, [key, tool]) => {
      const _tool = tool as any;
      acc[key] = {
        ..._tool,
        inputSchema: _tool.inputSchema ? stringify(zodToJsonSchema(_tool.inputSchema)) : undefined,
        outputSchema: _tool.outputSchema ? stringify(zodToJsonSchema(_tool.outputSchema)) : undefined,
      };
      return acc;
    }, {});

    const instructions = await agent.getInstructions({ runtimeContext });
    const llm = await agent.getLLM({ runtimeContext });

    return {
      name: agent.name,
      instructions,
      tools: serializedAgentTools,
      provider: llm?.getProvider(),
      modelId: llm?.getModelId(),
    };
  } catch (error) {
    return handleError(error, 'Error getting agent');
  }
}

export async function getEvalsByAgentIdHandler({
  mastra,
  runtimeContext,
  agentId,
}: Context & { runtimeContext: RuntimeContext; agentId: string }) {
  try {
    const agent = mastra.getAgent(agentId);
    const evals = (await mastra.getStorage()?.getEvalsByAgentName?.(agent.name, 'test')) || [];
    const instructions = await agent.getInstructions({ runtimeContext });
    return {
      id: agentId,
      name: agent.name,
      instructions,
      evals,
    };
  } catch (error) {
    return handleError(error, 'Error getting test evals');
  }
}

export async function getLiveEvalsByAgentIdHandler({
  mastra,
  runtimeContext,
  agentId,
}: Context & { runtimeContext: RuntimeContext; agentId: string }) {
  try {
    const agent = mastra.getAgent(agentId);
    const evals = (await mastra.getStorage()?.getEvalsByAgentName?.(agent.name, 'live')) || [];
    const instructions = await agent.getInstructions({ runtimeContext });

    return {
      id: agentId,
      name: agent.name,
      instructions,
      evals,
    };
  } catch (error) {
    return handleError(error, 'Error getting live evals');
  }
}

export async function generateHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'generate'> & {
    // @deprecated use resourceId
    resourceid?: string;
    runtimeContext?: Record<string, unknown>;
  };
}) {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, resourceId, resourceid, runtimeContext: agentRuntimeContext, ...rest } = body;
    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const result = await agent.generate(messages, {
      ...rest,
      // @ts-expect-error TODO fix types
      resourceId: finalResourceId,
      runtimeContext: finalRuntimeContext,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'stream'> & {
    // @deprecated use resourceId
    resourceid?: string;
    runtimeContext?: string;
  };
}): Promise<Response | undefined> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, resourceId, resourceid, runtimeContext: agentRuntimeContext, ...rest } = body;
    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = await agent.stream(messages, {
      ...rest,
      // @ts-expect-error TODO fix types
      resourceId: finalResourceId,
      runtimeContext: finalRuntimeContext,
    });

    const streamResponse = rest.output
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
    // @ts-expect-error TODO fix types
    throw new HTTPException(error?.status ?? 500, { message: error?.message ?? 'Error streaming from agent' });
  }
}
