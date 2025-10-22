import type { Agent, AgentModelManagerConfig } from '@mastra/core/agent';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { SystemMessage } from '@mastra/core/llm';
import type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';

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

type GetHITLBody<
  T extends keyof Agent & { [K in keyof Agent]: Agent[K] extends (...args: any) => any ? K : never }[keyof Agent],
> = Parameters<Agent[T]>[0];

export interface SerializedProcessor {
  name: string;
}

export interface SerializedTool {
  id: string;
  description?: string;
  inputSchema?: string;
  outputSchema?: string;
  requireApproval?: boolean;
}

export interface SerializedWorkflow {
  name: string;
  steps?: Record<string, { id: string; description?: string }>;
}

export interface SerializedAgent {
  name: string;
  instructions?: SystemMessage;
  tools: Record<string, SerializedTool>;
  agents: Record<string, SerializedAgentDefinition>;
  workflows: Record<string, SerializedWorkflow>;
  inputProcessors: SerializedProcessor[];
  outputProcessors: SerializedProcessor[];
  provider?: string;
  modelId?: string;
  modelVersion?: string;
  modelList?: Array<
    Omit<AgentModelManagerConfig, 'model'> & {
      model: {
        modelId: string;
        provider: string;
        modelVersion: string;
      };
    }
  >;
  // We can't use the true types here because they are not serializable
  defaultGenerateOptions?: Record<string, unknown>;
  defaultStreamOptions?: Record<string, unknown>;
}

export interface SerializedAgentWithId extends SerializedAgent {
  id: string;
}

export async function getSerializedAgentTools(tools: Record<string, unknown>): Promise<Record<string, SerializedTool>> {
  return Object.entries(tools || {}).reduce<Record<string, SerializedTool>>((acc, [key, tool]) => {
    const _tool = tool as {
      id?: string;
      description?: string;
      inputSchema?: { jsonSchema?: unknown } | unknown;
      outputSchema?: { jsonSchema?: unknown } | unknown;
    };

    const toolId = _tool.id ?? `tool-${key}`;

    let inputSchemaForReturn: string | undefined = undefined;
    let outputSchemaForReturn: string | undefined = undefined;

    try {
      if (_tool.inputSchema) {
        if (_tool.inputSchema && typeof _tool.inputSchema === 'object' && 'jsonSchema' in _tool.inputSchema) {
          inputSchemaForReturn = stringify(_tool.inputSchema.jsonSchema);
        } else if (typeof _tool.inputSchema === 'function') {
          const inputSchema = _tool.inputSchema();
          if (inputSchema && inputSchema.jsonSchema) {
            inputSchemaForReturn = stringify(inputSchema.jsonSchema);
          }
        } else if (_tool.inputSchema) {
          inputSchemaForReturn = stringify(zodToJsonSchema(_tool.inputSchema as Parameters<typeof zodToJsonSchema>[0]));
        }
      }

      if (_tool.outputSchema) {
        if (_tool.outputSchema && typeof _tool.outputSchema === 'object' && 'jsonSchema' in _tool.outputSchema) {
          outputSchemaForReturn = stringify(_tool.outputSchema.jsonSchema);
        } else if (typeof _tool.outputSchema === 'function') {
          const outputSchema = _tool.outputSchema();
          if (outputSchema && outputSchema.jsonSchema) {
            outputSchemaForReturn = stringify(outputSchema.jsonSchema);
          }
        } else if (_tool.outputSchema) {
          outputSchemaForReturn = stringify(
            zodToJsonSchema(_tool.outputSchema as Parameters<typeof zodToJsonSchema>[0]),
          );
        }
      }
    } catch (error) {
      console.error(`Error getting serialized tool`, {
        toolId: _tool.id,
        error,
      });
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

export function getSerializedProcessors(processors: (InputProcessor | OutputProcessor)[]): SerializedProcessor[] {
  return processors.map(processor => {
    // Processors are class instances or objects with a name property
    // Use the name property if available, otherwise fall back to constructor name
    return {
      name: processor.name || processor.constructor.name,
    };
  });
}

interface SerializedAgentDefinition {
  id: string;
  name: string;
}

async function getSerializedAgentDefinition({
  agent,
  runtimeContext,
}: {
  agent: Agent;
  runtimeContext: RuntimeContext;
}): Promise<Record<string, SerializedAgentDefinition>> {
  let serializedAgentAgents: Record<string, SerializedAgentDefinition> = {};

  if ('listAgents' in agent) {
    const agents = await agent.listAgents({ runtimeContext });
    serializedAgentAgents = Object.entries(agents || {}).reduce<Record<string, SerializedAgentDefinition>>(
      (acc, [key, agent]) => {
        return {
          ...acc,
          [key]: { id: agent.id, name: agent.name },
        };
      },
      {},
    );
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
}): Promise<SerializedAgentWithId> {
  const instructions = await agent.getInstructions({ runtimeContext });
  const tools = await agent.getTools({ runtimeContext });
  const llm = await agent.getLLM({ runtimeContext });
  const defaultGenerateOptions = await agent.getDefaultGenerateOptions({ runtimeContext });
  const defaultStreamOptions = await agent.getDefaultStreamOptions({ runtimeContext });
  const serializedAgentTools = await getSerializedAgentTools(tools);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps?: Record<string, { id: string; description?: string }> }
  > = {};

  if ('getWorkflows' in agent) {
    const logger = mastra.getLogger();
    try {
      const workflows = await agent.getWorkflows({ runtimeContext });
      serializedAgentWorkflows = Object.entries(workflows || {}).reduce<
        Record<string, { name: string; steps?: Record<string, { id: string; description?: string }> }>
      >((acc, [key, workflow]) => {
        return {
          ...acc,
          [key]: {
            name: workflow.name || 'Unnamed workflow',
          },
        };
      }, {});
    } catch (error) {
      logger.error('Error getting workflows for agent', { agentName: agent.name, error });
    }
  }

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, runtimeContext });

  // Get and serialize processors
  const inputProcessors = await agent.getInputProcessors(runtimeContext);
  const outputProcessors = await agent.getOutputProcessors(runtimeContext);
  const serializedInputProcessors = getSerializedProcessors(inputProcessors);
  const serializedOutputProcessors = getSerializedProcessors(outputProcessors);

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
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider: llm?.getProvider(),
    modelId: llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    defaultGenerateOptions,
    defaultStreamOptions,
    modelList,
  };
}

async function getAgentFromSystem({ mastra, agentId }: { mastra: Context['mastra']; agentId: string }) {
  const logger = mastra.getLogger();

  if (!agentId) {
    throw new HTTPException(400, { message: 'Agent ID is required' });
  }

  let agent;

  try {
    agent = mastra.getAgent(agentId);
  } catch (error) {
    logger.debug('Error getting agent from mastra, searching agents for agent', error);
  }

  if (!agent) {
    logger.debug('Agent not found, searching agents for agent', { agentId });
    const agents = mastra.getAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const agents = await ag.listAgents();

          if (agents[agentId]) {
            agent = agents[agentId];
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }
  }

  if (!agent) {
    throw new HTTPException(404, { message: 'Agent not found' });
  }

  return agent;
}

// Agent handlers
export async function getAgentsHandler({
  mastra,
  runtimeContext,
}: Context & { runtimeContext: RuntimeContext }): Promise<Record<string, SerializedAgent>> {
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
}): Promise<SerializedAgent> {
  const tools = await agent.getTools({ runtimeContext });

  const serializedAgentTools = await getSerializedAgentTools(tools);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps: Record<string, { id: string; description?: string }> }
  > = {};

  if ('getWorkflows' in agent) {
    const logger = mastra.getLogger();
    try {
      const workflows = await agent.getWorkflows({ runtimeContext });

      serializedAgentWorkflows = Object.entries(workflows || {}).reduce<
        Record<string, { name: string; steps: Record<string, { id: string; description?: string }> }>
      >((acc, [key, workflow]) => {
        return {
          ...acc,
          [key]: {
            name: workflow.name || 'Unnamed workflow',
            steps: Object.entries(workflow.steps).reduce<Record<string, { id: string; description?: string }>>(
              (acc, [key, step]) => {
                return {
                  ...acc,
                  [key]: {
                    id: step.id,
                    description: step.description,
                  },
                };
              },
              {},
            ),
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

  // Get and serialize processors
  const inputProcessors = await agent.getInputProcessors(proxyRuntimeContext);
  const outputProcessors = await agent.getOutputProcessors(proxyRuntimeContext);
  const serializedInputProcessors = getSerializedProcessors(inputProcessors);
  const serializedOutputProcessors = getSerializedProcessors(outputProcessors);

  return {
    name: agent.name,
    instructions,
    tools: serializedAgentTools,
    agents: serializedAgentAgents,
    workflows: serializedAgentWorkflows,
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider: llm?.getProvider(),
    modelId: llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    modelList,
    defaultGenerateOptions,
    defaultStreamOptions,
  };
}

export async function getAgentByIdHandler({
  mastra,
  runtimeContext,
  agentId,
  isPlayground = false,
}: Context & { isPlayground?: boolean; runtimeContext: RuntimeContext; agentId: string }): Promise<
  SerializedAgent | ReturnType<typeof handleError>
> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });
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

export async function generateLegacyHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'generateLegacy'> & {
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

    const result = await agent.generateLegacy(messages, {
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

export async function generateHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'generate'> & {
    runtimeContext?: Record<string, unknown>;
    format?: 'mastra' | 'aisdk';
  };
  abortSignal?: AbortSignal;
}): Promise<ReturnType<Agent['generate']>> {
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

    const result = await agent.generate(messages, {
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

export async function streamGenerateLegacyHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'streamLegacy'> & {
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

    const streamResult = await agent.streamLegacy(messages, {
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

export function streamGenerateHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'stream'> & {
    runtimeContext?: string;
    format?: 'aisdk' | 'mastra';
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['stream']> {
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

    const streamResult = agent.stream(messages, {
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

export function approveToolCallHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetHITLBody<'approveToolCall'> & {
    runtimeContext?: string;
    format?: 'aisdk' | 'mastra';
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['approveToolCall']> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { runId, runtimeContext: agentRuntimeContext, ...rest } = body;

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    const streamResult = agent.approveToolCall({
      ...rest,
      runId,
      runtimeContext: finalRuntimeContext,
      abortSignal,
      format: body.format ?? 'mastra',
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export function declineToolCallHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetHITLBody<'declineToolCall'> & {
    runtimeContext?: string;
    format?: 'aisdk' | 'mastra';
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['declineToolCall']> {
  try {
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { runId, runtimeContext: agentRuntimeContext, ...rest } = body;

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext.entries()),
      ...Array.from(Object.entries(agentRuntimeContext ?? {})),
    ]);

    const streamResult = agent.declineToolCall({
      ...rest,
      runId,
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
        options: rest.memory?.options ?? {},
      },
      runtimeContext: finalRuntimeContext,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent loop response');
  }
}

export async function streamUIMessageHandler({
  mastra,
  runtimeContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  body: GetBody<'stream'> & {
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

    const streamResult = await agent.stream(messages, {
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
      // Check if the provider is connected by checking for its API key env var(s)
      const envVars = Array.isArray(provider.apiKeyEnvVar) ? provider.apiKeyEnvVar : [provider.apiKeyEnvVar];
      const connected = envVars.every(envVar => !!process.env[envVar]);

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
