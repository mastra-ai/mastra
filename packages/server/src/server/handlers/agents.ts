import { Agent } from '@mastra/core/agent';
import type { AgentModelManagerConfig } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { SystemMessage } from '@mastra/core/llm';
import type {
  InputProcessor,
  OutputProcessor,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
import { z } from 'zod';

import { HTTPException } from '../http-exception';
import {
  agentIdPathParams,
  listAgentsResponseSchema,
  serializedAgentSchema,
  agentExecutionBodySchema,
  agentExecutionLegacyBodySchema,
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
  enhanceInstructionsBodySchema,
  enhanceInstructionsResponseSchema,
  approveNetworkToolCallBodySchema,
  declineNetworkToolCallBodySchema,
} from '../schemas/agents';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { handleError } from './error';
import { sanitizeBody, validateBody } from './utils';

/**
 * Checks if a provider has its required API key environment variable(s) configured.
 * Handles provider IDs with suffixes (e.g., "openai.chat" -> "openai").
 * @param providerId - The provider identifier (may include a suffix like ".chat")
 * @returns true if all required environment variables are set, false otherwise
 */
function isProviderConnected(providerId: string): boolean {
  // Clean provider ID (e.g., "openai.chat" -> "openai")
  const cleanId = providerId.includes('.') ? providerId.split('.')[0]! : providerId;
  const provider = PROVIDER_REGISTRY[cleanId as keyof typeof PROVIDER_REGISTRY];
  if (!provider) return false;

  const envVars = Array.isArray(provider.apiKeyEnvVar) ? provider.apiKeyEnvVar : [provider.apiKeyEnvVar];
  return envVars.every(envVar => !!process.env[envVar]);
}

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

interface SerializedToolInput {
  id?: string;
  description?: string;
  inputSchema?: { jsonSchema?: unknown } | unknown;
  outputSchema?: { jsonSchema?: unknown } | unknown;
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

export async function getSerializedAgentTools(
  tools: Record<string, SerializedToolInput>,
  partial: boolean = false,
): Promise<Record<string, SerializedTool>> {
  return Object.entries(tools || {}).reduce<Record<string, SerializedTool>>((acc, [key, tool]) => {
    const toolId = tool.id ?? `tool-${key}`;

    let inputSchemaForReturn: string | undefined = undefined;
    let outputSchemaForReturn: string | undefined = undefined;

    // Only process schemas if not in partial mode
    if (!partial) {
      try {
        if (tool.inputSchema) {
          if (tool.inputSchema && typeof tool.inputSchema === 'object' && 'jsonSchema' in tool.inputSchema) {
            inputSchemaForReturn = stringify(tool.inputSchema.jsonSchema);
          } else if (typeof tool.inputSchema === 'function') {
            const inputSchema = tool.inputSchema();
            if (inputSchema && inputSchema.jsonSchema) {
              inputSchemaForReturn = stringify(inputSchema.jsonSchema);
            }
          } else if (tool.inputSchema) {
            inputSchemaForReturn = stringify(
              zodToJsonSchema(tool.inputSchema as Parameters<typeof zodToJsonSchema>[0]),
            );
          }
        }

        if (tool.outputSchema) {
          if (tool.outputSchema && typeof tool.outputSchema === 'object' && 'jsonSchema' in tool.outputSchema) {
            outputSchemaForReturn = stringify(tool.outputSchema.jsonSchema);
          } else if (typeof tool.outputSchema === 'function') {
            const outputSchema = tool.outputSchema();
            if (outputSchema && outputSchema.jsonSchema) {
              outputSchemaForReturn = stringify(outputSchema.jsonSchema);
            }
          } else if (tool.outputSchema) {
            outputSchemaForReturn = stringify(
              zodToJsonSchema(tool.outputSchema as Parameters<typeof zodToJsonSchema>[0]),
            );
          }
        }
      } catch (error) {
        console.error(`Error getting serialized tool`, {
          toolId: tool.id,
          error,
        });
      }
    }

    acc[key] = {
      ...tool,
      id: toolId,
      inputSchema: inputSchemaForReturn,
      outputSchema: outputSchemaForReturn,
    };
    return acc;
  }, {});
}

export function getSerializedProcessors(
  processors: (InputProcessor | OutputProcessor | InputProcessorOrWorkflow | OutputProcessorOrWorkflow)[],
): SerializedProcessor[] {
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
  partial = false,
}: {
  id: string;
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
  partial?: boolean;
}): Promise<SerializedAgentWithId> {
  const description = agent.getDescription();
  const instructions = await agent.getInstructions({ requestContext });
  const tools = await agent.listTools({ requestContext });
  const llm = await agent.getLLM({ requestContext });
  const defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({ requestContext });
  const defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext });
  const defaultOptions = await agent.getDefaultOptions({ requestContext });
  const serializedAgentTools = await getSerializedAgentTools(tools, partial);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps?: Record<string, { id: string; description?: string }> }
  > = {};

  const logger = mastra.getLogger();

  if ('listWorkflows' in agent) {
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

  // Get and serialize only user-configured processors (excludes memory-derived processors)
  // This ensures the UI only shows processors explicitly configured by the user
  let serializedInputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  let serializedOutputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  try {
    const configuredProcessorWorkflows = await agent.getConfiguredProcessorWorkflows();
    const inputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-input-processor'));
    const outputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-output-processor'));
    serializedInputProcessors = getSerializedProcessors(inputProcessorWorkflows);
    serializedOutputProcessors = getSerializedProcessors(outputProcessorWorkflows);
  } catch (error) {
    logger.error('Error getting configured processors for agent', { agentName: agent.name, error });
  }

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
  isStudio,
}: {
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
  isStudio: boolean;
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
  if (isStudio) {
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

  // Get and serialize only user-configured processors (excludes memory-derived processors)
  // This ensures the UI only shows processors explicitly configured by the user
  let serializedInputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  let serializedOutputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  try {
    const configuredProcessorWorkflows = await agent.getConfiguredProcessorWorkflows();
    const inputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-input-processor'));
    const outputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-output-processor'));
    serializedInputProcessors = getSerializedProcessors(inputProcessorWorkflows);
    serializedOutputProcessors = getSerializedProcessors(outputProcessorWorkflows);
  } catch (error) {
    mastra.getLogger().error('Error getting configured processors for agent', { agentName: agent.name, error });
  }

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
  queryParamSchema: z.object({
    partial: z.string().optional(),
  }),
  responseSchema: listAgentsResponseSchema,
  summary: 'List all agents',
  description: 'Returns a list of all available agents in the system',
  tags: ['Agents'],
  requiresPermission: 'agents:read',
  handler: async ({ mastra, requestContext, partial }) => {
    try {
      const agents = mastra.listAgents();

      const isPartial = partial === 'true';
      const serializedAgentsMap = await Promise.all(
        Object.entries(agents).map(async ([id, agent]) => {
          return formatAgentList({ id, mastra, agent, requestContext, partial: isPartial });
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
  requiresPermission: 'agents:read',
  handler: async ({ agentId, mastra, requestContext }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });
      const isStudio = false; // TODO: Get from context if needed
      const result = await formatAgent({
        mastra,
        agent,
        requestContext,
        isStudio,
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
  requiresPermission: 'agents:execute',
  handler: async ({ agentId, mastra, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, ...rest } = params;

      validateBody({ messages });

      const result = await agent.generate<unknown>(messages, {
        ...rest,
        abortSignal,
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
  bodySchema: agentExecutionLegacyBodySchema,
  responseSchema: generateResponseSchema,
  summary: '[DEPRECATED] Generate with legacy format',
  description: 'Legacy endpoint for generating agent responses. Use /api/agents/:agentId/generate instead.',
  tags: ['Agents', 'Legacy'],
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, resourceId, resourceid, threadId, ...rest } = params;
      // Use resourceId if provided, fall back to resourceid (deprecated)
      const finalResourceId = resourceId ?? resourceid;

      validateBody({ messages });

      if ((threadId && !finalResourceId) || (!threadId && finalResourceId)) {
        throw new HTTPException(400, { message: 'Both threadId or resourceId must be provided' });
      }

      const result = await agent.generateLegacy(messages, {
        ...rest,
        abortSignal,
        resourceId: finalResourceId ?? '',
        threadId: threadId ?? '',
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
  bodySchema: agentExecutionLegacyBodySchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Stream with legacy format',
  description: 'Legacy endpoint for streaming agent responses. Use /api/agents/:agentId/stream instead.',
  tags: ['Agents', 'Legacy'],
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, resourceId, resourceid, threadId, ...rest } = params;
      // Use resourceId if provided, fall back to resourceid (deprecated)
      const finalResourceId = resourceId ?? resourceid;

      validateBody({ messages });

      if ((threadId && !finalResourceId) || (!threadId && finalResourceId)) {
        throw new HTTPException(400, { message: 'Both threadId or resourceId must be provided' });
      }

      const streamResult = await agent.streamLegacy(messages, {
        ...rest,
        abortSignal,
        resourceId: finalResourceId ?? '',
        threadId: threadId ?? '',
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
        return {
          id,
          name: provider.name,
          label: (provider as any).label || provider.name,
          description: (provider as any).description || '',
          envVar: provider.apiKeyEnvVar,
          connected: isProviderConnected(id),
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
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, ...rest } = params;
      validateBody({ messages });

      const streamResult = await agent.stream<unknown>(messages, {
        ...rest,
        abortSignal,
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
  deprecated: true,
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
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
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

      const streamResult = await agent.approveToolCall({
        ...params,
        abortSignal,
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
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
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

      const streamResult = await agent.declineToolCall({
        ...params,
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error declining tool call');
    }
  },
});

export const APPROVE_TOOL_CALL_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/approve-tool-call-generate',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: approveToolCallBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Approve tool call (non-streaming)',
  description: 'Approves a pending tool call and returns the complete response',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
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

      const result = await agent.approveToolCallGenerate({
        ...params,
        abortSignal,
      });

      return result;
    } catch (error) {
      return handleError(error, 'error approving tool call');
    }
  },
});

export const DECLINE_TOOL_CALL_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/decline-tool-call-generate',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: declineToolCallBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Decline tool call (non-streaming)',
  description: 'Declines a pending tool call and returns the complete response',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
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

      const result = await agent.declineToolCallGenerate({
        ...params,
        abortSignal,
      });

      return result;
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
  handler: async ({ mastra, messages, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      validateBody({ messages });

      const streamResult = await agent.network(messages, {
        ...params,
      });

      return streamResult;
    } catch (error) {
      return handleError(error, 'error streaming agent loop response');
    }
  },
});

export const APPROVE_NETWORK_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/approve-network-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: approveNetworkToolCallBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Approve network tool call',
  description: 'Approves a pending network tool call and continues network agent execution',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const streamResult = await agent.approveNetworkToolCall({
        ...params,
      });

      return streamResult;
    } catch (error) {
      return handleError(error, 'error approving network tool call');
    }
  },
});

export const DECLINE_NETWORK_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/decline-network-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: declineNetworkToolCallBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Decline network tool call',
  description: 'Declines a pending network tool call and continues network agent execution without executing the tool',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const streamResult = await agent.declineNetworkToolCall({
        ...params,
      });

      return streamResult;
    } catch (error) {
      return handleError(error, 'error declining network tool call');
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
        model: newModel,
        ...(maxRetries !== undefined ? { maxRetries } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      };

      agent.updateModelInModelList(updated);

      return { message: 'Model updated in model list' };
    } catch (error) {
      return handleError(error, 'error updating model in model list');
    }
  },
});

const ENHANCE_SYSTEM_PROMPT_INSTRUCTIONS = `You are an expert system prompt engineer, specialized in analyzing and enhancing instructions to create clear, effective, and comprehensive system prompts. Your goal is to help users transform their basic instructions into well-structured system prompts that will guide AI behavior effectively.

Follow these steps to analyze and enhance the instructions:

1. ANALYSIS PHASE
- Identify the core purpose and goals
- Extract key constraints and requirements
- Recognize domain-specific terminology and concepts
- Note any implicit assumptions that should be made explicit

2. PROMPT STRUCTURE
Create a system prompt with these components:
a) ROLE DEFINITION
    - Clear statement of the AI's role and purpose
    - Key responsibilities and scope
    - Primary stakeholders and users
b) CORE CAPABILITIES
    - Main functions and abilities
    - Specific domain knowledge required
    - Tools and resources available
c) BEHAVIORAL GUIDELINES
    - Communication style and tone
    - Decision-making framework
    - Error handling approach
    - Ethical considerations
d) CONSTRAINTS & BOUNDARIES
    - Explicit limitations
    - Out-of-scope activities
    - Security and privacy considerations
e) SUCCESS CRITERIA
    - Quality standards
    - Expected outcomes
    - Performance metrics

3. QUALITY CHECKS
Ensure the prompt is:
- Clear and unambiguous
- Comprehensive yet concise
- Properly scoped
- Technically accurate
- Ethically sound

4. OUTPUT FORMAT
Return a structured response with:
- Enhanced system prompt
- Analysis of key components
- Identified goals and constraints
- Core domain concepts

Remember: A good system prompt should be specific enough to guide behavior but flexible enough to handle edge cases. Focus on creating prompts that are clear, actionable, and aligned with the intended use case.`;

// Helper to find the first model with a connected provider
async function findConnectedModel(agent: Agent): Promise<Awaited<ReturnType<Agent['getModel']>> | null> {
  const modelList = await agent.getModelList();

  if (modelList && modelList.length > 0) {
    // Find the first enabled model with a connected provider
    for (const modelConfig of modelList) {
      if (modelConfig.enabled !== false) {
        const model = modelConfig.model;
        if (isProviderConnected(model.provider)) {
          return model;
        }
      }
    }
    return null;
  }

  // No model list, check the default model
  const defaultModel = await agent.getModel();
  if (isProviderConnected(defaultModel.provider)) {
    return defaultModel;
  }
  return null;
}

type EnhanceInstructionsResponse = z.infer<typeof enhanceInstructionsResponseSchema>;

export const ENHANCE_INSTRUCTIONS_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/instructions/enhance',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: enhanceInstructionsBodySchema,
  responseSchema: enhanceInstructionsResponseSchema,
  summary: 'Enhance agent instructions',
  description: 'Uses AI to enhance or modify agent instructions based on user feedback',
  tags: ['Agents'],
  handler: async ({ mastra, agentId, instructions, comment }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // Find the first model with a connected provider (similar to how chat works)
      const model = await findConnectedModel(agent);
      if (!model) {
        throw new HTTPException(400, {
          message:
            'No model with a configured API key found. Please set the required environment variable for your model provider.',
        });
      }

      const systemPromptAgent = new Agent({
        id: 'system-prompt-enhancer',
        name: 'system-prompt-enhancer',
        instructions: ENHANCE_SYSTEM_PROMPT_INSTRUCTIONS,
        model,
      });

      const result = await systemPromptAgent.generate(
        `We need to improve the system prompt.
Current: ${instructions}
${comment ? `User feedback: ${comment}` : ''}`,
        {
          structuredOutput: {
            schema: enhanceInstructionsResponseSchema,
          },
        },
      );

      return (await result.object) as unknown as EnhanceInstructionsResponse;
    } catch (error) {
      return handleError(error, 'Error enhancing instructions');
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
  deprecated: true,
  handler: async () => {
    throw new HTTPException(410, { message: 'This endpoint is deprecated. Please use /stream instead.' });
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
  deprecated: true,
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
  deprecated: true,
  handler: STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE.handler,
});
