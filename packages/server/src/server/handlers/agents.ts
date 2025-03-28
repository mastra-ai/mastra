import type { Agent } from '@mastra/core/agent';
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
export async function getAgentsHandler({ mastra }: Context) {
  try {
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

    return serializedAgents;
  } catch (error) {
    return handleError(error, 'Error getting agents');
  }
}

export async function getAgentByIdHandler({ mastra, agentId }: Context & { agentId: string }) {
  try {
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

    return {
      name: agent.name,
      instructions: agent.instructions,
      tools: serializedAgentTools,
      provider: agent.llm?.getProvider(),
      modelId: agent.llm?.getModelId(),
    };
  } catch (error) {
    return handleError(error, 'Error getting agent');
  }
}

export async function getEvalsByAgentIdHandler({ mastra, agentId }: Context & { agentId: string }) {
  try {
    const agent = mastra.getAgent(agentId);
    const evals = (await mastra.getStorage()?.getEvalsByAgentName?.(agent.name, 'test')) || [];
    return {
      id: agentId,
      name: agent.name,
      instructions: agent.instructions,
      evals,
    };
  } catch (error) {
    return handleError(error, 'Error getting test evals');
  }
}

export async function getLiveEvalsByAgentIdHandler({ mastra, agentId }: Context & { agentId: string }) {
  try {
    const agent = mastra.getAgent(agentId);
    const evals = (await mastra.getStorage()?.getEvalsByAgentName?.(agent.name, 'live')) || [];

    return {
      id: agentId,
      name: agent.name,
      instructions: agent.instructions,
      evals,
    };
  } catch (error) {
    return handleError(error, 'Error getting live evals');
  }
}

export async function generateHandler({
  mastra,
  agentId,
  body,
}: Context & {
  agentId: string;
  body: GetBody<'generate'>;
}) {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, ...rest } = body;
    validateBody({ messages });

    // @ts-expect-error TODO fix types
    const result = await agent.generate(messages, rest);

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler({
  mastra,
  agentId,
  body,
}: Context & { agentId: string; body: GetBody<'stream'> }): Promise<Response | undefined> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, output, ...rest } = body;
    validateBody({ messages });

    // @ts-expect-error TODO fix types
    const streamResult = await agent.stream(messages, { output, ...rest });

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
    // @ts-expect-error TODO fix types
    throw new HTTPException(error?.status ?? 500, { message: error?.message ?? 'Error streaming from agent' });
  }
}
