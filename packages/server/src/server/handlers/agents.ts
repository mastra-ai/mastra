import type { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';

import type {
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
} from '../../../../core/dist/llm/model/base.types';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { sanitizeBody, validateBody } from './utils';

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

async function getSerializedAgentDefinition({
  agent,
  runtimeContext,
}: {
  agent: Agent;
  runtimeContext: RuntimeContext;
}) {
  let serializedAgentAgents = {};

  if ('listAgents' in agent) {
    const agents = await agent.listAgents({ runtimeContext });
    serializedAgentAgents = Object.entries(agents || {}).reduce<any>((acc, [key, agent]) => {
      return {
        ...acc,
        [key]: { id: agent.id, name: agent.name },
      };
    }, {});
  }
  return serializedAgentAgents;
}

async function formatAgentList({
  id,
  mastra,
  agent,
  runtimeContext,
}: {
  id: string;
  mastra: Context['mastra'];
  agent: Agent;
  runtimeContext: RuntimeContext;
}) {
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

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, runtimeContext });

  const model = llm?.getModel();
  const models = await agent.getModelList(runtimeContext);
  const modelList = models?.map(md => ({
    ...md,
    model: {
      modelId: md.model.modelId,
      provider: md.model.provider,
      modelVersion: md.model.specificationVersion,
    },
  }));

  return {
    id,
    name: agent.name,
    instructions,
    agents: serializedAgentAgents,
    tools: serializedAgentTools,
    workflows: serializedAgentWorkflows,
    provider: llm?.getProvider(),
    modelId: llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    defaultGenerateOptions: defaultGenerateOptions as any,
    defaultStreamOptions: defaultStreamOptions as any,
    modelList,
  };
}

// Agent handlers
export async function getAgentsHandler({ mastra, runtimeContext }: Context & { runtimeContext: RuntimeContext }) {
  try {
    const agents = mastra.getAgents();

    const serializedAgentsMap = await Promise.all(
      Object.entries(agents).map(async ([id, agent]) => {
        return formatAgentList({ id, mastra, agent, runtimeContext });
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

async function formatAgent({
  mastra,
  agent,
  runtimeContext,
  isPlayground,
}: {
  mastra: Context['mastra'];
  agent: Agent;
  runtimeContext: RuntimeContext;
  isPlayground: boolean;
}) {
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
    const models = await agent.getModelList(runtimeContext);
    const modelList = models?.map(md => ({
      ...md,
      model: {
        modelId: md.model.modelId,
        provider: md.model.provider,
        modelVersion: md.model.specificationVersion,
      },
    }));

    const serializedAgentAgents = await getSerializedAgentDefinition({ agent, runtimeContext: proxyRuntimeContext });

    return {
      name: agent.name,
      instructions,
      tools: serializedAgentTools,
      agents: serializedAgentAgents,
      workflows: serializedAgentWorkflows,
      provider: llm?.getProvider(),
      modelId: llm?.getModelId(),
      modelVersion: model?.specificationVersion,
      modelList,
      defaultGenerateOptions: defaultGenerateOptions as any,
      defaultStreamOptions: defaultStreamOptions as any,
    };
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
    return formatAgent({ mastra, agent, runtimeContext, isPlayground });
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
    "Deprecation NOTICE:\nGenerate method will switch to use generateVNext implementation the week of September 30th, 2025. Please use generateLegacyHandler if you don't want to upgrade just yet.",
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

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

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

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

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
      abortSignal,
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
    "Deprecation NOTICE:\n Stream method will switch to use streamVNext implementation the week of September 30th, 2025. Please use streamGenerateLegacyHandler if you don't want to upgrade just yet.",
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

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, runtimeContext: agentRuntimeContext, ...rest } = body;
    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = agent.streamVNext(messages, {
      ...rest,
      runtimeContext: finalRuntimeContext,
      abortSignal,
      format: body.format ?? 'mastra',
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export function streamNetworkHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  // abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'network'> & {
    thread?: string;
    resourceId?: string;
  };
  // abortSignal?: AbortSignal;
}): ReturnType<Agent['network']> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, runtimeContext: agentRuntimeContext, ...rest } = body;
    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = agent.network(messages, {
      ...rest,
      memory: {
        thread: rest.thread ?? '',
        resource: rest.resourceId ?? '',
      },
      runtimeContext: finalRuntimeContext,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent loop response');
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
  body: Omit<GetBody<'streamVNext'>, 'onStepFinish' | 'onFinish' | 'output'> & {
    runtimeContext?: string;
    onStepFinish?: StreamTextOnStepFinishCallback<any>;
    onFinish?: StreamTextOnFinishCallback<any>;
    output?: undefined;
  };
  abortSignal?: AbortSignal;
}): Promise<Response | undefined> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, runtimeContext: agentRuntimeContext, ...rest } = body;
    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = await agent.streamVNext(messages, {
      ...rest,
      runtimeContext: finalRuntimeContext,
      abortSignal,
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
    provider: string;
  };
}): Promise<{ message: string }> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const { modelId, provider } = body;

    // Use the universal Mastra router format: provider/model
    const newModel = `${provider}/${modelId}`;

    agent.__updateModel({ model: newModel });

    return { message: 'Agent model updated' };
  } catch (error) {
    return handleError(error, 'error updating agent model');
  }
}

export async function reorderAgentModelListHandler({
  mastra,
  agentId,
  body,
}: Context & {
  agentId: string;
  body: {
    reorderedModelIds: Array<string>;
  };
}): Promise<{ message: string }> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const modelList = await agent.getModelList();
    if (!modelList || modelList.length === 0) {
      throw new HTTPException(400, { message: 'Agent model list is not found or empty' });
    }

    agent.reorderModels(body.reorderedModelIds);

    return { message: 'Model list reordered' };
  } catch (error) {
    return handleError(error, 'error reordering model list');
  }
}

export async function updateAgentModelInModelListHandler({
  mastra,
  agentId,
  modelConfigId,
  body,
}: Context & {
  agentId: string;
  modelConfigId: string;
  body: {
    model?: {
      modelId: string;
      provider: string;
    };
    maxRetries?: number;
    enabled?: boolean;
  };
}): Promise<{ message: string }> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }
    const { model: bodyModel, maxRetries, enabled } = body;

    if (!modelConfigId) {
      throw new HTTPException(400, { message: 'Model id is required' });
    }

    const modelList = await agent.getModelList();
    if (!modelList || modelList.length === 0) {
      throw new HTTPException(400, { message: 'Agent model list is not found or empty' });
    }

    const modelToUpdate = modelList.find(m => m.id === modelConfigId);
    if (!modelToUpdate) {
      throw new HTTPException(400, { message: 'Model to update is not found in agent model list' });
    }

    let model: string | undefined;
    if (bodyModel) {
      const { modelId, provider } = bodyModel;
      // Use the universal Mastra router format: provider/model
      model = `${provider}/${modelId}`;
    }

    agent.updateModelInModelList({ id: modelConfigId, model, maxRetries, enabled });

    return { message: 'Model list updated' };
  } catch (error) {
    return handleError(error, 'error updating model list');
  }
}

export async function getProvidersHandler() {
  try {
    const providers = Object.entries(PROVIDER_REGISTRY).map(([id, provider]) => {
      // Check if the provider is connected by checking for its API key env var
      const connected = !!process.env[provider.apiKeyEnvVar];

      return {
        id,
        name: provider.name,
        envVar: provider.apiKeyEnvVar,
        connected,
        docUrl: provider.docUrl,
        models: [...provider.models], // Convert readonly array to regular array
      };
    });

    return { providers };
  } catch (error) {
    return handleError(error, 'error fetching providers');
  }
}
