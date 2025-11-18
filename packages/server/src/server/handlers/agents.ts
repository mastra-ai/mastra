import type { Agent, AgentModelManagerConfig } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { SystemMessage } from '@mastra/core/llm';
import type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
import type { z } from 'zod';

import { HTTPException } from '../http-exception';
import {
  agentIdPathParams,
  listAgentsResponseSchema,
  serializedAgentSchema,
  agentExecutionBodySchema,
  generateResponseSchema,
  streamResponseSchema,
  providersResponseSchema,
  approveToolCallBodySchema,
  declineToolCallBodySchema,
  toolCallResponseSchema,
  updateAgentModelBodySchema,
  reorderAgentModelListBodySchema,
  updateAgentModelInModelListBodySchema,
  modelManagementResponseSchema,
  modelConfigIdPathParams,
} from '../schemas/agents';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { handleError } from './error';
import { sanitizeBody, validateBody } from './utils';

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

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_AGENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agents',
  responseType: 'json',
  responseSchema: listAgentsResponseSchema,
  summary: 'List all agents',
  description: 'Returns a list of all available agents in the system',
  tags: ['Agents'],
  handler: async ({ mastra, requestContext }) => {
    try {
      const agents = mastra.listAgents();

      const serializedAgentsMap = await Promise.all(
        Object.entries(agents).map(async ([id, agent]) => {
          return formatAgentList({ id, mastra, agent, requestContext: requestContext ?? new RequestContext() });
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
  },
});

export const GET_AGENT_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agents/:agentId',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: serializedAgentSchema,
  summary: 'Get agent by ID',
  description: 'Returns details for a specific agent including configuration, tools, and memory settings',
  tags: ['Agents'],
  handler: async ({ agentId, mastra, requestContext }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });
      const isPlayground = false; // TODO: Get from context if needed
      const result = await formatAgent({
        mastra,
        agent,
        requestContext: requestContext ?? new RequestContext(),
        isPlayground,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error getting agent');
    }
  },
});

export const GENERATE_AGENT_ROUTE: ServerRoute<
  z.infer<typeof agentIdPathParams> & z.infer<typeof agentExecutionBodySchema>,
  unknown
> = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/generate',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Generate agent response',
  description: 'Executes an agent with the provided messages and returns the complete response',
  tags: ['Agents'],
  handler: async ({ agentId, mastra, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, requestContext: agentRequestContext, ...rest } = params as any;

      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      validateBody({ messages });

      const result = await agent.generate(messages, {
        ...rest,
        requestContext: finalRequestContext,
        abortSignal: undefined, // TODO: Get abortSignal from context if needed
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error generating from agent');
    }
  },
});

// Legacy routes (deprecated)
export const GENERATE_LEGACY_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/generate-legacy',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: generateResponseSchema,
  summary: '[DEPRECATED] Generate with legacy format',
  description: 'Legacy endpoint for generating agent responses. Use /api/agents/:agentId/generate instead.',
  tags: ['Agents', 'Legacy'],
  handler: async ({ mastra, requestContext, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, resourceId, resourceid, requestContext: agentRequestContext, ...rest } = params as any;
      // Use resourceId if provided, fall back to resourceid (deprecated)
      const finalResourceId = resourceId ?? resourceid;

      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      validateBody({ messages });

      const result = await agent.generateLegacy(messages, {
        ...rest,
        abortSignal: undefined, // TODO: Get abortSignal from context if needed
        resourceId: finalResourceId,
        requestContext: finalRequestContext,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error generating from agent');
    }
  },
});

export const STREAM_GENERATE_LEGACY_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/stream-legacy',
  responseType: 'datastream-response' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Stream with legacy format',
  description: 'Legacy endpoint for streaming agent responses. Use /api/agents/:agentId/stream instead.',
  tags: ['Agents', 'Legacy'],
  handler: async ({ mastra, requestContext, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, resourceId, resourceid, requestContext: agentRequestContext, ...rest } = params as any;
      // Use resourceId if provided, fall back to resourceid (deprecated)
      const finalResourceId = resourceId ?? resourceid;

      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      validateBody({ messages });

      const streamResult = await agent.streamLegacy(messages, {
        ...rest,
        abortSignal: undefined, // TODO: Get abortSignal from context if needed
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
  },
});

export const GET_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agents/providers',
  responseType: 'json',
  responseSchema: providersResponseSchema,
  summary: 'List AI providers',
  description: 'Returns a list of all configured AI model providers',
  tags: ['Agents'],
  handler: async () => {
    try {
      const providers = Object.entries(PROVIDER_REGISTRY).map(([id, provider]) => {
        // Check if the provider is connected by checking for its API key env var(s)
        const envVars = Array.isArray(provider.apiKeyEnvVar) ? provider.apiKeyEnvVar : [provider.apiKeyEnvVar];
        const connected = envVars.every(envVar => !!process.env[envVar]);

        return {
          id,
          name: provider.name,
          label: (provider as any).label || provider.name,
          description: (provider as any).description || '',
          envVar: provider.apiKeyEnvVar,
          connected,
          docUrl: provider.docUrl,
          models: [...provider.models], // Convert readonly array to regular array
        };
      });
      return { providers };
    } catch (error) {
      return handleError(error, 'Error fetching providers');
    }
  },
});

export const GENERATE_AGENT_VNEXT_ROUTE: ServerRoute<
  z.infer<typeof agentIdPathParams> & z.infer<typeof agentExecutionBodySchema>,
  unknown
> = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/generate/vnext',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Generate a response from an agent',
  description: 'Generate a response from an agent',
  tags: ['Agents'],
  handler: GENERATE_AGENT_ROUTE.handler,
});

export const STREAM_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream agent response',
  description: 'Executes an agent with the provided messages and streams the response in real-time',
  tags: ['Agents'],
  handler: async ({ mastra, requestContext, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, requestContext: agentRequestContext, ...rest } = params as any;
      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      validateBody({ messages });

      const streamResult = await agent.stream(messages, {
        ...rest,
        requestContext: finalRequestContext,
        abortSignal: undefined, // TODO: Get abortSignal from context if needed
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error streaming agent response');
    }
  },
});

export const STREAM_GENERATE_VNEXT_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/stream/vnext',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream a response from an agent',
  description: '[DEPRECATED] This endpoint is deprecated. Please use /stream instead.',
  tags: ['Agents'],
  handler: STREAM_GENERATE_ROUTE.handler,
});

export const APPROVE_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/approve-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: approveToolCallBodySchema,
  responseSchema: toolCallResponseSchema,
  summary: 'Approve tool call',
  description: 'Approves a pending tool call and continues agent execution',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, requestContext, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { runId, requestContext: agentRequestContext, ...rest } = params as any;

      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      const streamResult = await agent.approveToolCall({
        ...rest,
        runId,
        requestContext: finalRequestContext,
        abortSignal: undefined, // TODO: Get abortSignal from context if needed
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error approving tool call');
    }
  },
});

export const DECLINE_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/decline-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: declineToolCallBodySchema,
  responseSchema: toolCallResponseSchema,
  summary: 'Decline tool call',
  description: 'Declines a pending tool call and continues agent execution without executing the tool',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, requestContext, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { runId, requestContext: agentRequestContext, ...rest } = params as any;

      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      const streamResult = await agent.declineToolCall({
        ...rest,
        runId,
        requestContext: finalRequestContext,
        abortSignal: undefined, // TODO: Get abortSignal from context if needed
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error declining tool call');
    }
  },
});

export const STREAM_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/network',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream agent network',
  description: 'Executes an agent network with multiple agents and streams the response',
  tags: ['Agents'],
  handler: async ({ mastra, requestContext, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, requestContext: agentRequestContext, ...rest } = params as any;
      const finalRequestContext = new RequestContext<Record<string, unknown>>([
        ...Array.from(requestContext?.entries() ?? []),
        ...Array.from(Object.entries(agentRequestContext ?? {})),
      ]);

      validateBody({ messages });

      const streamResult = await agent.network(messages, {
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
  },
});

export const UPDATE_AGENT_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/model',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: updateAgentModelBodySchema,
  responseSchema: modelManagementResponseSchema,
  summary: 'Update agent model',
  description: 'Updates the AI model used by the agent',
  tags: ['Agents', 'Models'],
  handler: async ({ mastra, agentId, modelId, provider }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // Use the universal Mastra router format: provider/model
      const newModel = `${provider}/${modelId}`;

      agent.__updateModel({ model: newModel });

      return { message: 'Agent model updated' };
    } catch (error) {
      return handleError(error, 'error updating agent model');
    }
  },
});

export const RESET_AGENT_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/model/reset',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: modelManagementResponseSchema,
  summary: 'Reset agent model',
  description: 'Resets the agent model to its original configuration',
  tags: ['Agents', 'Models'],
  handler: async ({ mastra, agentId }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      agent.__resetToOriginalModel();

      return { message: 'Agent model reset to original' };
    } catch (error) {
      return handleError(error, 'error resetting agent model');
    }
  },
});

export const REORDER_AGENT_MODEL_LIST_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/models/reorder',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: reorderAgentModelListBodySchema,
  responseSchema: modelManagementResponseSchema,
  summary: 'Reorder agent model list',
  description: 'Reorders the model list for agents with multiple model configurations',
  tags: ['Agents', 'Models'],
  handler: async ({ mastra, agentId, reorderedModelIds }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      const modelList = await agent.getModelList();
      if (!modelList || modelList.length === 0) {
        throw new HTTPException(400, { message: 'Agent model list is not found or empty' });
      }

      agent.reorderModels(reorderedModelIds);

      return { message: 'Model list reordered' };
    } catch (error) {
      return handleError(error, 'error reordering model list');
    }
  },
});

export const UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/models/:modelConfigId',
  responseType: 'json',
  pathParamSchema: modelConfigIdPathParams,
  bodySchema: updateAgentModelInModelListBodySchema,
  responseSchema: modelManagementResponseSchema,
  summary: 'Update model in model list',
  description: 'Updates a specific model configuration in the agent model list',
  tags: ['Agents', 'Models'],
  handler: async ({ mastra, agentId, modelConfigId, model: bodyModel, maxRetries, enabled }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      const modelList = await agent.getModelList();
      if (!modelList || modelList.length === 0) {
        throw new HTTPException(400, { message: 'Agent model list is not found or empty' });
      }

      const modelConfig = modelList.find(config => config.id === modelConfigId);
      if (!modelConfig) {
        throw new HTTPException(404, { message: `Model config with id ${modelConfigId} not found` });
      }

      const newModel =
        bodyModel?.modelId && bodyModel?.provider ? `${bodyModel.provider}/${bodyModel.modelId}` : modelConfig.model;

      const updated = {
        ...modelConfig,
        model: newModel as any,
        ...(maxRetries !== undefined ? { maxRetries } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      };

      agent.updateModelInModelList(updated as any);

      return { message: 'Model updated in model list' };
    } catch (error) {
      return handleError(error, 'error updating model in model list');
    }
  },
});

export const STREAM_VNEXT_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/streamVNext',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream a response from an agent',
  description: '[DEPRECATED] This endpoint is deprecated. Please use /stream instead.',
  tags: ['Agents'],
  handler: async () => {
    throw new Error('This endpoint is deprecated. Please use /stream instead.');
  },
});

export const STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/stream/vnext/ui',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream UI messages from an agent',
  description:
    '[DEPRECATED] This endpoint is deprecated. Please use the @mastra/ai-sdk package for uiMessage transformations',
  tags: ['Agents'],
  handler: async () => {
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
  },
});

export const STREAM_UI_MESSAGE_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/stream/ui',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream UI messages from an agent',
  description:
    '[DEPRECATED] This endpoint is deprecated. Please use the @mastra/ai-sdk package for uiMessage transformations',
  tags: ['Agents'],
  handler: STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE.handler,
});
