import { anthropic } from '@ai-sdk/anthropic';
import { anthropic as anthropicV5 } from '@ai-sdk/anthropic-v5';
import { google } from '@ai-sdk/google';
import { google as googleV5 } from '@ai-sdk/google-v5';
import { groq } from '@ai-sdk/groq';
import { groq as groqV5 } from '@ai-sdk/groq-v5';
import { openai } from '@ai-sdk/openai';
import { openai as openaiV5 } from '@ai-sdk/openai-v5';
import { xai } from '@ai-sdk/xai';
import { xai as xaiV5 } from '@ai-sdk/xai-v5';
import type { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';

import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

type GetBody<
  T extends keyof Agent & { [K in keyof Agent]: Agent[K] extends (...args: any) => any ? K : never }[keyof Agent],
> = {
  messages: Parameters<Agent[T]>[0];
} & Parameters<Agent[T]>[1];

export async function getSerializedAgentTools(tools: Record<string, any>) {
  return Object.entries(tools || {}).reduce<any>((acc, [key, tool]) => {
    const _tool = tool as any;

    const toolId = _tool.id ?? `tool-${key}`;

    let inputSchemaForReturn = undefined;

    if (_tool.inputSchema) {
      if (_tool.inputSchema?.jsonSchema) {
        inputSchemaForReturn = stringify(_tool.inputSchema.jsonSchema);
      } else {
        inputSchemaForReturn = stringify(zodToJsonSchema(_tool.inputSchema));
      }
    }

    let outputSchemaForReturn = undefined;

    if (_tool.outputSchema) {
      if (_tool.outputSchema?.jsonSchema) {
        outputSchemaForReturn = stringify(_tool.outputSchema.jsonSchema);
      } else {
        outputSchemaForReturn = stringify(zodToJsonSchema(_tool.outputSchema));
      }
    }

    acc[key] = {
      ..._tool,
      id: toolId,
      inputSchema: inputSchemaForReturn,
      outputSchema: outputSchemaForReturn,
    };
    return acc;
  }, {});
}

// Agent handlers
export async function getAgentsHandler({ mastra, runtimeContext }: Context & { runtimeContext: RuntimeContext }) {
  try {
    const agents = mastra.getAgents();

    const serializedAgentsMap = await Promise.all(
      Object.entries(agents).map(async ([id, agent]) => {
        const instructions = await agent.getInstructions({ runtimeContext });
        const tools = await agent.getTools({ runtimeContext });
        const llm = await agent.getLLM({ runtimeContext });
        const defaultGenerateOptions = await agent.getDefaultGenerateOptions({ runtimeContext });
        const defaultStreamOptions = await agent.getDefaultStreamOptions({ runtimeContext });

        const serializedAgentTools = await getSerializedAgentTools(tools);

        let serializedAgentWorkflows = {};

        if ('getWorkflows' in agent) {
          const logger = mastra.getLogger();
          try {
            const workflows = await agent.getWorkflows({ runtimeContext });
            serializedAgentWorkflows = Object.entries(workflows || {}).reduce<any>((acc, [key, workflow]) => {
              return {
                ...acc,
                [key]: {
                  name: workflow.name,
                },
              };
            }, {});
          } catch (error) {
            logger.error('Error getting workflows for agent', { agentName: agent.name, error });
          }
        }

        const model = llm?.getModel();

        return {
          id,
          name: agent.name,
          instructions,
          tools: serializedAgentTools,
          workflows: serializedAgentWorkflows,
          provider: llm?.getProvider(),
          modelId: llm?.getModelId(),
          modelVersion: model?.specificationVersion,
          defaultGenerateOptions: defaultGenerateOptions as any,
          defaultStreamOptions: defaultStreamOptions as any,
        };
      }),
    );

    const serializedAgents = serializedAgentsMap.reduce<
      Record<string, Omit<(typeof serializedAgentsMap)[number], 'id'>>
    >((acc, { id, ...rest }) => {
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
  isPlayground = false,
}: Context & { isPlayground?: boolean; runtimeContext: RuntimeContext; agentId: string }) {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const tools = await agent.getTools({ runtimeContext });

    const serializedAgentTools = await getSerializedAgentTools(tools);

    let serializedAgentWorkflows = {};

    if ('getWorkflows' in agent) {
      const logger = mastra.getLogger();
      try {
        const workflows = await agent.getWorkflows({ runtimeContext });

        serializedAgentWorkflows = Object.entries(workflows || {}).reduce<any>((acc, [key, workflow]) => {
          return {
            ...acc,
            [key]: {
              name: workflow.name,
              steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
                return {
                  ...acc,
                  [key]: {
                    id: step.id,
                    description: step.description,
                  },
                };
              }, {}),
            },
          };
        }, {});
      } catch (error) {
        logger.error('Error getting workflows for agent', { agentName: agent.name, error });
      }
    }

    let proxyRuntimeContext = runtimeContext;
    if (isPlayground) {
      proxyRuntimeContext = new Proxy(runtimeContext, {
        get(target, prop) {
          if (prop === 'get') {
            return function (key: string) {
              const value = target.get(key);
              return value ?? `<${key}>`;
            };
          }
          return Reflect.get(target, prop);
        },
      });
    }

    const instructions = await agent.getInstructions({ runtimeContext: proxyRuntimeContext });
    const llm = await agent.getLLM({ runtimeContext });
    const defaultGenerateOptions = await agent.getDefaultGenerateOptions({ runtimeContext: proxyRuntimeContext });
    const defaultStreamOptions = await agent.getDefaultStreamOptions({ runtimeContext: proxyRuntimeContext });

    const model = llm?.getModel();

    return {
      name: agent.name,
      instructions,
      tools: serializedAgentTools,
      workflows: serializedAgentWorkflows,
      provider: llm?.getProvider(),
      modelId: llm?.getModelId(),
      modelVersion: model?.specificationVersion,
      defaultGenerateOptions: defaultGenerateOptions as any,
      defaultStreamOptions: defaultStreamOptions as any,
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

export function generateHandler({
  mastra,
  ...args
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'generate'> & {
    // @deprecated use resourceId
    resourceid?: string;
    runtimeContext?: Record<string, unknown>;
  };
  abortSignal?: AbortSignal;
}) {
  const logger = mastra.getLogger();
  logger?.warn(
    "Deprecation NOTICE:\nGenerate method will switch to use generateVNext implementation September 16th. Please use generateLegacyHandler if you don't want to upgrade just yet.",
  );
  return generateLegacyHandler({ mastra, ...args });
}

export async function generateLegacyHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'generate'> & {
    // @deprecated use resourceId
    resourceid?: string;
    runtimeContext?: Record<string, unknown>;
  };
  abortSignal?: AbortSignal;
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
      abortSignal,
      // @ts-expect-error TODO fix types
      resourceId: finalResourceId,
      runtimeContext: finalRuntimeContext,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function generateVNextHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'generateVNext'> & {
    runtimeContext?: Record<string, unknown>;
    format?: 'mastra' | 'aisdk';
  };
  abortSignal?: AbortSignal;
}): Promise<ReturnType<Agent['generateVNext']>> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, runtimeContext: agentRuntimeContext, ...rest } = body;

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const result = await agent.generateVNext(messages, {
      ...rest,
      runtimeContext: finalRuntimeContext,
      format: rest.format || 'mastra',
      options: {
        ...(rest?.options ?? {}),
        abortSignal,
      },
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateHandler({
  mastra,
  ...args
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'stream'> & {
    // @deprecated use resourceId
    resourceid?: string;
    runtimeContext?: string;
  };
  abortSignal?: AbortSignal;
}) {
  const logger = mastra.getLogger();
  logger?.warn(
    "Deprecation NOTICE:\n Stream method will switch to use streamVNext implementation September 16th. Please use streamGenerateLegacyHandler if you don't want to upgrade just yet.",
  );

  return streamGenerateLegacyHandler({ mastra, ...args });
}
export async function streamGenerateLegacyHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'stream'> & {
    // @deprecated use resourceId
    resourceid?: string;
    runtimeContext?: string;
  };
  abortSignal?: AbortSignal;
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
      abortSignal,
      // @ts-expect-error TODO fix types
      resourceId: finalResourceId,
      runtimeContext: finalRuntimeContext,
    });

    const streamResponse = rest.output
      ? streamResult.toTextStreamResponse({
          headers: {
            'Transfer-Encoding': 'chunked',
          },
        })
      : streamResult.toDataStreamResponse({
          sendUsage: true,
          sendReasoning: true,
          getErrorMessage: (error: any) => {
            return `An error occurred while processing your request. ${error instanceof Error ? error.message : JSON.stringify(error)}`;
          },
          headers: {
            'Transfer-Encoding': 'chunked',
          },
        });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export function streamVNextGenerateHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'streamVNext'> & {
    runtimeContext?: string;
    format?: 'aisdk' | 'mastra';
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['streamVNext']> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, runtimeContext: agentRuntimeContext, ...rest } = body;
    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = agent.streamVNext(messages, {
      ...rest,
      runtimeContext: finalRuntimeContext,
      options: {
        ...(rest?.options ?? {}),
        abortSignal,
      },
      format: body.format ?? 'mastra',
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export async function streamVNextUIMessageHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'streamVNext'> & {
    runtimeContext?: string;
  };
  abortSignal?: AbortSignal;
}): Promise<Response | undefined> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { messages, runtimeContext: agentRuntimeContext, ...rest } = body;
    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = await agent.streamVNext(messages, {
      ...rest,
      runtimeContext: finalRuntimeContext,
      options: {
        ...(rest?.options ?? {}),
        abortSignal,
      },
      format: 'aisdk',
    });

    return streamResult.toUIMessageStreamResponse();
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export async function updateAgentModelHandler({
  mastra,
  agentId,
  body,
}: Context & {
  agentId: string;
  body: {
    modelId: string;
    provider: 'openai' | 'anthropic' | 'groq' | 'xai' | 'google';
  };
}): Promise<{ message: string }> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const agentModel = await agent.getModel();
    const modelVersion = agentModel.specificationVersion;

    const { modelId, provider } = body;

    const providerMap = {
      v1: {
        openai: openai(modelId),
        anthropic: anthropic(modelId),
        groq: groq(modelId),
        xai: xai(modelId),
        google: google(modelId),
      },
      v2: {
        openai: openaiV5(modelId),
        anthropic: anthropicV5(modelId),
        groq: groqV5(modelId),
        xai: xaiV5(modelId),
        google: googleV5(modelId),
      },
    };

    const modelVersionKey = modelVersion === 'v2' ? 'v2' : 'v1';

    let model = providerMap[modelVersionKey][provider];

    agent.__updateModel({ model });

    return { message: 'Agent model updated' };
  } catch (error) {
    return handleError(error, 'error updating agent model');
  }
}
