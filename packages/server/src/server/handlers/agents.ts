import type { Agent, AgentModelManagerConfig } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { SystemMessage } from '@mastra/core/llm';
import type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
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
  id: string;
  name?: string;
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
  description?: string;
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
  defaultOptions?: Record<string, unknown>;
  defaultGenerateOptionsLegacy?: Record<string, unknown>;
  defaultStreamOptionsLegacy?: Record<string, unknown>;
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
      id: processor.id,
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
  requestContext,
}: {
  agent: Agent;
  requestContext: RequestContext;
}): Promise<Record<string, SerializedAgentDefinition>> {
  let serializedAgentAgents: Record<string, SerializedAgentDefinition> = {};

  if ('listAgents' in agent) {
    const agents = await agent.listAgents({ requestContext });
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
  requestContext,
}: {
  id: string;
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
}): Promise<SerializedAgentWithId> {
  const description = agent.getDescription();
  const instructions = await agent.getInstructions({ requestContext });
  const tools = await agent.listTools({ requestContext });
  const llm = await agent.getLLM({ requestContext });
  const defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({ requestContext });
  const defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext });
  const defaultOptions = await agent.getDefaultOptions({ requestContext });
  const serializedAgentTools = await getSerializedAgentTools(tools);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps?: Record<string, { id: string; description?: string }> }
  > = {};

  if ('listWorkflows' in agent) {
    const logger = mastra.getLogger();
    try {
      const workflows = await agent.listWorkflows({ requestContext });
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

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, requestContext });

  // Get and serialize processors
  const inputProcessors = await agent.listInputProcessors(requestContext);
  const outputProcessors = await agent.listOutputProcessors(requestContext);
  const serializedInputProcessors = getSerializedProcessors(inputProcessors);
  const serializedOutputProcessors = getSerializedProcessors(outputProcessors);

  const model = llm?.getModel();
  const models = await agent.getModelList(requestContext);
  const modelList = models?.map(md => ({
    ...md,
    model: {
      modelId: md.model.modelId,
      provider: md.model.provider,
      modelVersion: md.model.specificationVersion,
    },
  }));

  return {
    id: agent.id || id,
    name: agent.name,
    description,
    instructions,
    agents: serializedAgentAgents,
    tools: serializedAgentTools,
    workflows: serializedAgentWorkflows,
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider: llm?.getProvider(),
    modelId: llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    defaultOptions,
    modelList,
    defaultGenerateOptionsLegacy,
    defaultStreamOptionsLegacy,
  };
}

export async function getAgentFromSystem({ mastra, agentId }: { mastra: Context['mastra']; agentId: string }) {
  const logger = mastra.getLogger();

  if (!agentId) {
    throw new HTTPException(400, { message: 'Agent ID is required' });
  }

  let agent;

  try {
    agent = mastra.getAgentById(agentId);
  } catch (error) {
    logger.debug('Error getting agent from mastra, searching agents for agent', error);
  }

  if (!agent) {
    logger.debug(`Agent ${agentId} not found, looking through sub-agents`);
    const agents = mastra.listAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const subAgents = await ag.listAgents();

          if (subAgents[agentId]) {
            agent = subAgents[agentId];
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }
  }

  if (!agent) {
    throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
  }

  return agent;
}

// Agent handlers
export async function listAgentsHandler({
  mastra,
  requestContext,
}: Context & { requestContext: RequestContext }): Promise<Record<string, SerializedAgent>> {
  try {
    const agents = mastra.listAgents();

    const serializedAgentsMap = await Promise.all(
      Object.entries(agents).map(async ([id, agent]) => {
        return formatAgentList({ id, mastra, agent, requestContext });
      }),
    );

    const serializedAgents = serializedAgentsMap.reduce<Record<string, (typeof serializedAgentsMap)[number]>>(
      (acc, { id, ...rest }) => {
        acc[id] = { id, ...rest };
        return acc;
      },
      {},
    );

    return serializedAgents;
  } catch (error) {
    return handleError(error, 'Error getting agents');
  }
}

async function formatAgent({
  mastra,
  agent,
  requestContext,
  isPlayground,
}: {
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
  isPlayground: boolean;
}): Promise<SerializedAgent> {
  const description = agent.getDescription();
  const tools = await agent.listTools({ requestContext });

  const serializedAgentTools = await getSerializedAgentTools(tools);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps: Record<string, { id: string; description?: string }> }
  > = {};

  if ('listWorkflows' in agent) {
    const logger = mastra.getLogger();
    try {
      const workflows = await agent.listWorkflows({ requestContext });

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

  let proxyRequestContext = requestContext;
  if (isPlayground) {
    proxyRequestContext = new Proxy(requestContext, {
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

  const instructions = await agent.getInstructions({ requestContext: proxyRequestContext });
  const llm = await agent.getLLM({ requestContext });
  const defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({
    requestContext: proxyRequestContext,
  });
  const defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext: proxyRequestContext });
  const defaultOptions = await agent.getDefaultOptions({ requestContext: proxyRequestContext });

  const model = llm?.getModel();
  const models = await agent.getModelList(requestContext);
  const modelList = models?.map(md => ({
    ...md,
    model: {
      modelId: md.model.modelId,
      provider: md.model.provider,
      modelVersion: md.model.specificationVersion,
    },
  }));

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, requestContext: proxyRequestContext });

  // Get and serialize processors
  const inputProcessors = await agent.listInputProcessors(proxyRequestContext);
  const outputProcessors = await agent.listOutputProcessors(proxyRequestContext);
  const serializedInputProcessors = getSerializedProcessors(inputProcessors);
  const serializedOutputProcessors = getSerializedProcessors(outputProcessors);

  return {
    name: agent.name,
    description,
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
    defaultOptions,
    defaultGenerateOptionsLegacy,
    defaultStreamOptionsLegacy,
  };
}

export async function getAgentByIdHandler({
  mastra,
  requestContext,
  agentId,
  isPlayground = false,
}: Context & { isPlayground?: boolean; requestContext: RequestContext; agentId: string }): Promise<
  SerializedAgent | ReturnType<typeof handleError>
> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    return formatAgent({ mastra, agent, requestContext, isPlayground });
  } catch (error) {
    return handleError(error, 'Error getting agent');
  }
}

export async function generateLegacyHandler({
  mastra,
  requestContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetBody<'generateLegacy'> & {
    // @deprecated use resourceId
    resourceid?: string;
    requestContext?: Record<string, unknown>;
  };
  abortSignal?: AbortSignal;
}) {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, resourceId, resourceid, requestContext: agentRequestContext, ...rest } = body;
    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    validateBody({ messages });

    const result = await agent.generateLegacy(messages, {
      ...rest,
      abortSignal,
      // @ts-expect-error TODO fix types
      resourceId: finalResourceId,
      requestContext: finalRequestContext,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function generateHandler({
  mastra,
  requestContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetBody<'generate'> & {
    requestContext?: Record<string, unknown>;
  };
  abortSignal?: AbortSignal;
}): Promise<ReturnType<Agent['generate']>> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, requestContext: agentRequestContext, ...rest } = body;

    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    validateBody({ messages });

    const result = await agent.generate(messages, {
      ...rest,
      requestContext: finalRequestContext,
      abortSignal,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateLegacyHandler({
  mastra,
  requestContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetBody<'streamLegacy'> & {
    // @deprecated use resourceId
    resourceid?: string;
    requestContext?: string;
  };
  abortSignal?: AbortSignal;
}): Promise<Response | undefined> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    const { messages, resourceId, resourceid, requestContext: agentRequestContext, ...rest } = body;
    // Use resourceId if provided, fall back to resourceid (deprecated)
    const finalResourceId = resourceId ?? resourceid;

    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = await agent.streamLegacy(messages, {
      ...rest,
      abortSignal,
      // @ts-expect-error TODO fix types
      resourceId: finalResourceId,
      requestContext: finalRequestContext,
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

export async function streamGenerateHandler({
  mastra,
  requestContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetBody<'stream'> & {
    requestContext?: string;
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['stream']> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, requestContext: agentRequestContext, ...rest } = body;
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = agent.stream(messages, {
      ...rest,
      requestContext: finalRequestContext,
      abortSignal,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export async function approveToolCallHandler({
  mastra,
  requestContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetHITLBody<'approveToolCall'> & {
    requestContext?: string;
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['approveToolCall']> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    if (!body.runId) {
      throw new HTTPException(400, { message: 'Run id is required' });
    }

    if (!body.toolCallId) {
      throw new HTTPException(400, { message: 'Tool call id is required' });
    }

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { runId, requestContext: agentRequestContext, ...rest } = body;

    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    const streamResult = agent.approveToolCall({
      ...rest,
      runId,
      requestContext: finalRequestContext,
      abortSignal,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export async function declineToolCallHandler({
  mastra,
  requestContext,
  agentId,
  body,
  abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetHITLBody<'declineToolCall'> & {
    requestContext?: string;
  };
  abortSignal?: AbortSignal;
}): ReturnType<Agent['declineToolCall']> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    if (!body.runId) {
      throw new HTTPException(400, { message: 'Run id is required' });
    }

    if (!body.toolCallId) {
      throw new HTTPException(400, { message: 'Tool call id is required' });
    }

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { runId, requestContext: agentRequestContext, ...rest } = body;

    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    const streamResult = agent.declineToolCall({
      ...rest,
      runId,
      requestContext: finalRequestContext,
      abortSignal,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent response');
  }
}

export async function streamNetworkHandler({
  mastra,
  requestContext,
  agentId,
  body,
  // abortSignal,
}: Context & {
  requestContext: RequestContext;
  agentId: string;
  body: GetBody<'network'> & {
    thread?: string;
    resourceId?: string;
  };
  // abortSignal?: AbortSignal;
}): ReturnType<Agent['network']> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    // UI Frameworks may send "client tools" in the body,
    // but it interferes with llm providers tool handling, so we remove them
    sanitizeBody(body, ['tools']);

    const { messages, requestContext: agentRequestContext, ...rest } = body;
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext.entries()),
      ...Array.from(Object.entries(agentRequestContext ?? {})),
    ]);

    validateBody({ messages });

    const streamResult = agent.network(messages, {
      ...rest,
      memory: {
        thread: rest.thread ?? '',
        resource: rest.resourceId ?? '',
        options: rest.memory?.options ?? {},
      },
      requestContext: finalRequestContext,
    });

    return streamResult;
  } catch (error) {
    return handleError(error, 'error streaming agent loop response');
  }
}

export async function streamUIMessageHandler(
  _params: Context & {
    requestContext: RequestContext;
    agentId: string;
    body: GetBody<'stream'> & {
      requestContext?: string;
      onStepFinish?: StreamTextOnStepFinishCallback<any>;
      onFinish?: StreamTextOnFinishCallback<any>;
      output?: undefined;
    };
    abortSignal?: AbortSignal;
  },
): Promise<Response | undefined> {
  try {
    throw new MastraError({
      category: ErrorCategory.USER,
      domain: ErrorDomain.MASTRA_SERVER,
      id: 'DEPRECATED_ENDPOINT',
      text: 'This endpoint is deprecated. Please use the @mastra/ai-sdk package to for uiMessage transformations',
    });
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
    const agent = await getAgentFromSystem({ mastra, agentId });

    const { modelId, provider } = body;

    // Use the universal Mastra router format: provider/model
    const newModel = `${provider}/${modelId}`;

    agent.__updateModel({ model: newModel });

    return { message: 'Agent model updated' };
  } catch (error) {
    return handleError(error, 'error updating agent model');
  }
}

export async function resetAgentModelHandler({
  mastra,
  agentId,
}: Context & {
  agentId: string;
}): Promise<{ message: string }> {
  try {
    const agent = await getAgentFromSystem({ mastra, agentId });

    agent.__resetToOriginalModel();

    return { message: 'Agent model reset to original' };
  } catch (error) {
    return handleError(error, 'error resetting agent model');
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
    const agent = await getAgentFromSystem({ mastra, agentId });

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
    const agent = await getAgentFromSystem({ mastra, agentId });

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
