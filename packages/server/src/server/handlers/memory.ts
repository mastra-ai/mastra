import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/di';
import type { MastraMemory } from '@mastra/core/memory';
import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import { HTTPException } from '../http-exception';
import {
  threadIdPathParams,
  agentIdQuerySchema,
  getMemoryStatusQuerySchema,
  getMemoryConfigQuerySchema,
  listThreadsQuerySchema,
  getThreadByIdQuerySchema,
  listMessagesQuerySchema,
  getWorkingMemoryQuerySchema,
  deleteThreadQuerySchema,
  deleteMessagesQuerySchema,
  getMemoryStatusNetworkQuerySchema,
  listThreadsNetworkQuerySchema,
  getThreadByIdNetworkQuerySchema,
  listMessagesNetworkQuerySchema,
  saveMessagesNetworkQuerySchema,
  createThreadNetworkQuerySchema,
  updateThreadNetworkQuerySchema,
  deleteThreadNetworkQuerySchema,
  deleteMessagesNetworkQuerySchema,
  memoryStatusResponseSchema,
  memoryConfigResponseSchema,
  listThreadsResponseSchema,
  getThreadByIdResponseSchema,
  listMessagesResponseSchema,
  getWorkingMemoryResponseSchema,
  saveMessagesBodySchema,
  createThreadBodySchema,
  updateThreadBodySchema,
  updateWorkingMemoryBodySchema,
  deleteMessagesBodySchema,
  searchMemoryQuerySchema,
  saveMessagesResponseSchema,
  updateWorkingMemoryResponseSchema,
  searchMemoryResponseSchema,
  deleteThreadResponseSchema,
  deleteMessagesResponseSchema,
  cloneThreadBodySchema,
  cloneThreadResponseSchema,
  getObservationalMemoryQuerySchema,
  getObservationalMemoryResponseSchema,
  awaitBufferStatusBodySchema,
  awaitBufferStatusResponseSchema,
} from '../schemas/memory';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { handleError } from './error';
import {
  getGatewayClient,
  isGatewayAgentAsync,
  toLocalThread,
  toLocalMessage,
  toLocalOMRecord,
} from './gateway-memory-client';
import { validateBody, getEffectiveResourceId, getEffectiveThreadId, validateThreadOwnership } from './utils';

interface MemoryContext extends Context {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext;
}

interface SearchResult {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  threadId?: string;
  threadTitle?: string;
  score?: number;
  context?: {
    before?: SearchResult[];
    after?: SearchResult[];
  };
}

export function getTextContent(message: MastraDBMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content && typeof message.content === 'object' && 'parts' in message.content) {
    const textPart = message.content.parts.find(p => p.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

async function getMemoryFromContext({
  mastra,
  agentId,
  requestContext,
  allowMissingAgent = false,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'> & {
  allowMissingAgent?: boolean;
}): Promise<MastraMemory | null | undefined> {
  const logger = mastra.getLogger();
  let agent;
  if (agentId) {
    try {
      agent = mastra.getAgentById(agentId);
    } catch (error) {
      logger.debug('Error getting agent from mastra, searching agents for agent', error);
    }
  }
  if (agentId && !agent) {
    logger.debug('Agent not found in registered agents, trying stored agents', { agentId });
    try {
      const storedAgent = (await mastra.getEditor()?.agent.getById(agentId)) ?? null;
      if (storedAgent) {
        agent = storedAgent;
      }
    } catch (error) {
      logger.debug('Error getting stored agent', error);
    }
  }

  if (agentId && !agent) {
    logger.debug('Stored agent not found, searching sub-agents', { agentId });
    const agents = mastra.listAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const subAgents = await ag.listAgents({ requestContext });

          if (subAgents[agentId]) {
            agent = subAgents[agentId];
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }

    if (!agent) {
      if (allowMissingAgent) {
        logger.debug('Agent not found in any resolution tier, returning null for storage fallback', { agentId });
        return null;
      }
      throw new HTTPException(404, { message: 'Agent not found' });
    }
  }

  if (agent) {
    return await agent?.getMemory({
      requestContext,
    });
  }
}

/**
 * Gets the storage from context, used as a fallback when agent memory can't be resolved.
 * This covers both cases where no agentId is provided and where the agentId refers to
 * a stored agent whose memory instance can't be hydrated (e.g. no editor configured).
 */
function getStorageFromContext({ mastra }: Pick<MemoryContext, 'mastra'>): MastraStorage | undefined {
  return mastra.getStorage();
}

/**
 * Gets the agent from context for OM processor detection.
 */
async function getAgentFromContext({
  mastra,
  agentId,
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'>): Promise<Agent | null> {
  if (!agentId) return null;

  const logger = mastra.getLogger();
  let agent: Agent | null = null;

  // First try registered agents
  try {
    agent = mastra.getAgentById(agentId);
  } catch (error) {
    logger.debug('Error getting agent from mastra', error);
  }

  // Then try stored agents
  if (!agent) {
    logger.debug('Agent not found in registered agents, trying stored agents', { agentId });
    try {
      const storedAgent = (await mastra.getEditor()?.agent.getById(agentId)) ?? null;
      if (storedAgent) {
        agent = storedAgent;
      }
    } catch (error) {
      logger.debug('Error getting stored agent', error);
    }
  }

  // Finally search sub-agents with requestContext
  if (!agent) {
    logger.debug('Stored agent not found, searching sub-agents', { agentId });
    const agents = mastra.listAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const nestedAgents = await ag.listAgents({ requestContext });
          if (nestedAgents[agentId]) {
            agent = nestedAgents[agentId];
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }
  }

  return agent;
}

/**
 * Gets Observational Memory configuration from an agent's processors.
 * Returns null if OM is not enabled.
 */
async function getOMConfigFromAgent(
  agent: Agent,
  requestContext?: RequestContext,
): Promise<{
  enabled: boolean;
  scope?: 'thread' | 'resource';
  shareTokenBudget?: boolean;
  messageTokens?: number | { min: number; max: number };
  observationTokens?: number | { min: number; max: number };
  observationModel?: string;
  reflectionModel?: string;
  observationModelRouting?: Array<{ upTo: number; model: string }>;
  reflectionModelRouting?: Array<{ upTo: number; model: string }>;
} | null> {
  try {
    // Guard against older @mastra/core versions that don't have resolveProcessorById
    if (typeof agent.resolveProcessorById !== 'function') {
      return null;
    }
    const omProcessor = await agent.resolveProcessorById('observational-memory', requestContext);
    if (!omProcessor) {
      return null;
    }

    // Use getResolvedConfig if available (properly resolves model names)
    // Fall back to .config for backwards compatibility
    const hasResolvedConfig = typeof (omProcessor as any).getResolvedConfig === 'function';

    if (hasResolvedConfig) {
      const resolvedConfig = await (omProcessor as any).getResolvedConfig(requestContext);
      return {
        enabled: true,
        scope: resolvedConfig.scope || 'resource',
        shareTokenBudget: resolvedConfig.shareTokenBudget,
        messageTokens: resolvedConfig.observation?.messageTokens,
        observationTokens: resolvedConfig.reflection?.observationTokens,
        observationModel: resolvedConfig.observation?.model,
        reflectionModel: resolvedConfig.reflection?.model,
        observationModelRouting: resolvedConfig.observation?.routing,
        reflectionModelRouting: resolvedConfig.reflection?.routing,
      };
    }

    // Fallback for older processor versions
    const processorConfig = (omProcessor as any).config || {};
    return {
      enabled: true,
      scope: processorConfig.scope || 'resource',
      shareTokenBudget: processorConfig.shareTokenBudget,
      messageTokens: processorConfig.observation?.messageTokens,
      observationTokens: processorConfig.reflection?.observationTokens,
      observationModel: undefined,
      reflectionModel: undefined,
      observationModelRouting: undefined,
      reflectionModelRouting: undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Gets Observational Memory status for a specific resource/thread.
 */
async function getOMStatus(
  memoryStorage: MemoryStorage,
  resourceId: string,
  threadId?: string,
): Promise<{
  hasRecord: boolean;
  originType?: string;
  lastObservedAt?: Date | null;
  tokenCount?: number;
  observationTokenCount?: number;
  isObserving?: boolean;
  isReflecting?: boolean;
} | null> {
  try {
    const record = await memoryStorage.getObservationalMemory(threadId ?? null, resourceId);
    if (!record) {
      return { hasRecord: false };
    }

    return {
      hasRecord: true,
      originType: record.originType,
      lastObservedAt: record.lastObservedAt ?? null,
      tokenCount: record.totalTokensObserved,
      observationTokenCount: record.observationTokenCount,
      isObserving: record.isObserving,
      isReflecting: record.isReflecting,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const GET_MEMORY_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/status',
  responseType: 'json',
  queryParamSchema: getMemoryStatusQuerySchema,
  responseSchema: memoryStatusResponseSchema,
  summary: 'Get memory status',
  description: 'Returns the current status of the memory system including configuration and health information',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, resourceId, threadId, requestContext }) => {
    try {
      // Check if this is a gateway agent first
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      const isGateway = agent ? await isGatewayAgentAsync(agent) : false;
      if (agent && isGateway) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          // Gateway memory is available — check for OM status via gateway
          let omStatus:
            | {
                enabled: boolean;
                hasRecord?: boolean;
                originType?: string;
                lastObservedAt?: Date;
                tokenCount?: number;
                observationTokenCount?: number;
                isObserving?: boolean;
                isReflecting?: boolean;
              }
            | undefined;

          if (resourceId && threadId) {
            try {
              const { record } = await gwClient.getObservationRecord(threadId, resourceId);
              if (record) {
                omStatus = {
                  enabled: true,
                  hasRecord: true,
                  originType: record.originType,
                  lastObservedAt: record.lastObservedAt ? new Date(record.lastObservedAt) : undefined,
                  tokenCount: record.totalTokensObserved,
                  observationTokenCount: record.observationTokenCount,
                  isObserving: record.isObserving,
                  isReflecting: record.isReflecting,
                };
              } else {
                omStatus = { enabled: true, hasRecord: false };
              }
            } catch {
              omStatus = { enabled: true };
            }
          } else {
            omStatus = { enabled: true };
          }

          return { result: true, memoryType: 'gateway' as const, observationalMemory: omStatus };
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });

      if (memory) {
        // Check for Observational Memory
        let omStatus:
          | {
              enabled: boolean;
              hasRecord?: boolean;
              originType?: string;
              lastObservedAt?: Date;
              tokenCount?: number;
              observationTokenCount?: number;
              isObserving?: boolean;
              isReflecting?: boolean;
            }
          | undefined;

        if (agent) {
          const omConfig = await getOMConfigFromAgent(agent, requestContext);
          if (omConfig?.enabled && resourceId) {
            // For resource-scoped OM, lookup by resourceId only (threadId=null)
            const omThreadId = omConfig.scope === 'resource' ? undefined : threadId;
            // Get OM status from the agent's memory storage (not mastra.getStorage())
            try {
              const memoryStore = await memory.storage.getStore('memory');
              if (memoryStore) {
                const status = await getOMStatus(memoryStore, resourceId, omThreadId);
                if (status) {
                  omStatus = {
                    enabled: true,
                    ...status,
                    // Convert null to undefined for schema compatibility
                    lastObservedAt: status.lastObservedAt ?? undefined,
                  };
                } else {
                  omStatus = { enabled: true, hasRecord: false };
                }
              }
            } catch {
              // Storage not configured, just mark as enabled
              omStatus = { enabled: true };
            }
          } else if (omConfig?.enabled) {
            omStatus = { enabled: true };
          }
        }

        return { result: true, memoryType: 'local' as const, observationalMemory: omStatus };
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        return { result: true };
      }

      return { result: false };
    } catch (error) {
      return handleError(error, 'Error getting memory status');
    }
  },
});

export const GET_MEMORY_CONFIG_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/config',
  responseType: 'json',
  queryParamSchema: getMemoryConfigQuerySchema,
  responseSchema: memoryConfigResponseSchema,
  summary: 'Get memory configuration',
  description: 'Returns the memory configuration for a specific agent or the system default',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      // For gateway agents, return config with default OM thresholds
      // These match @mastra/memory's OBSERVATIONAL_MEMORY_DEFAULTS
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent)) && getGatewayClient()) {
        return {
          memoryType: 'gateway' as const,
          config: {
            observationalMemory: {
              enabled: true,
              scope: 'thread' as const,
              messageTokens: 30_000,
              observationTokens: 40_000,
            },
          },
        };
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });

      if (!memory) {
        // Return null config when memory is not configured (Issue #11765)
        // This allows the playground UI to gracefully handle agents without memory
        return { config: null };
      }

      // Get the merged configuration (defaults + custom)
      const config = memory.getMergedThreadConfig({});

      // Check for Observational Memory config
      let omConfig:
        | {
            enabled: boolean;
            scope?: 'thread' | 'resource';
            messageTokens?: number | { min: number; max: number };
            observationTokens?: number | { min: number; max: number };
            observationModel?: string;
            reflectionModel?: string;
          }
        | undefined;

      if (agent) {
        omConfig = (await getOMConfigFromAgent(agent, requestContext)) ?? { enabled: false };
      }

      return {
        config: {
          ...config,
          observationalMemory: omConfig,
        },
      };
    } catch (error) {
      return handleError(error, 'Error getting memory configuration');
    }
  },
});

export const GET_OBSERVATIONAL_MEMORY_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/observational-memory',
  responseType: 'json',
  queryParamSchema: getObservationalMemoryQuerySchema,
  responseSchema: getObservationalMemoryResponseSchema,
  summary: 'Get observational memory data',
  description: 'Returns the current observational memory record and optional history for a resource/thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, resourceId, threadId, from, to, offset, limit, requestContext }) => {
    try {
      // Verify agent has OM enabled
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      const historyLimit = limit ?? 5;
      const historyOptions = { from, to, offset };

      // Gateway OM: proxy to gateway API
      if (await isGatewayAgentAsync(agent)) {
        const gwClient = getGatewayClient();
        if (gwClient && resourceId && threadId) {
          const [recordResult, historyResult] = await Promise.all([
            gwClient.getObservationRecord(threadId, resourceId),
            gwClient.getObservationHistory(threadId, { resourceId, limit: historyLimit, from, to, offset }),
          ]);
          return {
            record: recordResult.record ? toLocalOMRecord(recordResult.record) : null,
            history: historyResult.records?.length > 0 ? historyResult.records.map(toLocalOMRecord) : undefined,
          };
        }
        // No threadId or resourceId yet (e.g. /chat/new) — return empty
        return { record: null, history: undefined };
      }

      const omConfig = await getOMConfigFromAgent(agent, requestContext);
      if (!omConfig?.enabled) {
        throw new HTTPException(400, { message: 'Observational Memory is not enabled for this agent' });
      }

      // Get storage from the agent's memory (not mastra.getStorage())
      // This ensures we use the same storage the agent uses for OM
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not configured for this agent' });
      }

      let memoryStore: MemoryStorage | undefined;
      try {
        memoryStore = await memory.storage.getStore('memory');
      } catch {
        throw new HTTPException(400, { message: 'Memory storage is not initialized' });
      }
      if (!memoryStore) {
        throw new HTTPException(400, { message: 'Memory storage is not initialized' });
      }

      // Determine the resourceId to use
      const effectiveResourceId = resourceId;
      if (!effectiveResourceId) {
        throw new HTTPException(400, { message: 'resourceId is required for observational memory lookup' });
      }

      // For resource-scoped OM, lookup by resourceId only (threadId=null)
      const omThreadId = omConfig.scope === 'resource' ? null : (threadId ?? null);

      // Get current record
      const record = await memoryStore.getObservationalMemory(omThreadId, effectiveResourceId);

      // Get history
      const history = await memoryStore.getObservationalMemoryHistory(
        omThreadId,
        effectiveResourceId,
        historyLimit,
        historyOptions,
      );

      return {
        record: record ?? null,
        history: history.length > 0 ? history : undefined,
      };
    } catch (error) {
      return handleError(error, 'Error getting observational memory');
    }
  },
});

export const AWAIT_BUFFER_STATUS_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/observational-memory/buffer-status',
  responseType: 'json',
  bodySchema: awaitBufferStatusBodySchema,
  responseSchema: awaitBufferStatusResponseSchema,
  summary: 'Await observational memory buffering completion',
  description:
    'Blocks until any in-flight buffering operations complete for the given thread/resource, then returns the updated record',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, resourceId, threadId, requestContext }: MemoryContext) => {
    try {
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      // Gateway proxy: poll the gateway OM record until buffering flags clear
      if (await isGatewayAgentAsync(agent)) {
        const gwClient = getGatewayClient();
        if (gwClient && resourceId && threadId) {
          const maxWaitMs = 30_000;
          const pollIntervalMs = 1_000;
          const deadline = Date.now() + maxWaitMs;

          let record: ReturnType<typeof toLocalOMRecord> | null = null;
          while (Date.now() < deadline) {
            const result = await gwClient.getObservationRecord(threadId, resourceId);
            record = result.record ? toLocalOMRecord(result.record) : null;
            if (!record || (!record.isBufferingObservation && !record.isBufferingReflection)) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          }
          return { record };
        }
        return { record: null };
      }

      const omConfig = await getOMConfigFromAgent(agent, requestContext);
      if (!omConfig?.enabled) {
        throw new HTTPException(400, { message: 'Observational Memory is not enabled for this agent' });
      }

      // Resolve the OM processor to call waitForBuffering
      const omProcessor = await agent.resolveProcessorById('observational-memory', requestContext);
      if (!omProcessor || typeof (omProcessor as any).waitForBuffering !== 'function') {
        throw new HTTPException(400, { message: 'Observational Memory processor not available' });
      }

      // Block until buffering completes (30s timeout)
      await (omProcessor as any).waitForBuffering(threadId, resourceId);

      // After buffering, fetch the updated record
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not configured for this agent' });
      }

      let memoryStore: MemoryStorage | undefined;
      try {
        memoryStore = await memory.storage.getStore('memory');
      } catch {
        throw new HTTPException(400, { message: 'Memory storage is not initialized' });
      }
      if (!memoryStore) {
        throw new HTTPException(400, { message: 'Memory storage is not initialized' });
      }

      const effectiveResourceId = resourceId;
      if (!effectiveResourceId) {
        throw new HTTPException(400, { message: 'resourceId is required' });
      }

      const omThreadId = omConfig.scope === 'resource' ? null : (threadId ?? null);
      const record = await memoryStore.getObservationalMemory(omThreadId, effectiveResourceId);

      return { record: record ?? null };
    } catch (error) {
      console.error('Error awaiting buffer status', error);
      return handleError(error, 'Error awaiting buffer status');
    }
  },
});

export const LIST_THREADS_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads',
  responseType: 'json',
  queryParamSchema: listThreadsQuerySchema,
  responseSchema: listThreadsResponseSchema,
  summary: 'List memory threads',
  description:
    'Returns a paginated list of conversation threads with optional filtering by resource ID and/or metadata',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, resourceId, metadata, requestContext, page, perPage, orderBy }) => {
    try {
      // Use effective resourceId (context key takes precedence over client-provided value)
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      // Gateway proxy: list threads from gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      const isGateway = agent ? await isGatewayAgentAsync(agent) : false;
      if (agent && isGateway) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          const effectivePage = page ?? 0;
          const effectivePerPage = perPage ?? 100;
          const offset = effectivePage * effectivePerPage;
          const result = await gwClient.listThreads({
            resourceId: effectiveResourceId,
            limit: effectivePerPage,
            offset,
          });
          return {
            threads: result.threads.map(toLocalThread),
            page: effectivePage,
            perPage: effectivePerPage,
            total: result.total,
            hasMore: offset + result.threads.length < result.total,
          };
        }
      }

      // Build filter object dynamically based on provided parameters
      const filter: { resourceId?: string; metadata?: Record<string, unknown> } | undefined =
        effectiveResourceId || metadata ? {} : undefined;

      if (effectiveResourceId) {
        filter!.resourceId = effectiveResourceId;
      }
      if (metadata) {
        filter!.metadata = metadata;
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });

      if (memory) {
        const result = await memory.listThreads({
          filter,
          page,
          perPage,
          orderBy,
        });
        return result;
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        const memoryStore = await storage.getStore('memory');
        if (memoryStore) {
          const result = await memoryStore.listThreads({
            filter,
            page,
            perPage,
            orderBy,
          });
          return result;
        }
      }

      throw new HTTPException(400, { message: 'Memory is not initialized' });
    } catch (error) {
      return handleError(error, 'Error listing threads');
    }
  },
});

export const GET_THREAD_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: getThreadByIdQuerySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Get thread by ID',
  description: 'Returns details for a specific conversation thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, resourceId, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId });

      // Gateway proxy: get thread from gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      const isGateway = agent ? await isGatewayAgentAsync(agent) : false;
      if (agent && isGateway) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          const result = await gwClient.getThread(effectiveThreadId!);
          if (!result) {
            // Thread hasn't been created on gateway yet (created on first message).
            // Return a placeholder so the UI doesn't error.
            return {
              id: effectiveThreadId!,
              resourceId: effectiveResourceId ?? '',
              title: '',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          const thread = toLocalThread(result.thread);
          await validateThreadOwnership(thread, effectiveResourceId);
          return thread;
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (memory) {
        const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
        if (!thread) {
          throw new HTTPException(404, { message: 'Thread not found' });
        }
        await validateThreadOwnership(thread, effectiveResourceId);
        return thread;
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        const memoryStore = await storage.getStore('memory');
        if (memoryStore) {
          const thread = await memoryStore.getThreadById({ threadId: effectiveThreadId! });
          if (!thread) {
            throw new HTTPException(404, { message: 'Thread not found' });
          }
          await validateThreadOwnership(thread, effectiveResourceId);
          return thread;
        }
      }

      throw new HTTPException(400, { message: 'Memory is not initialized' });
    } catch (error) {
      return handleError(error, 'Error getting thread');
    }
  },
});

export const LIST_MESSAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads/:threadId/messages',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: listMessagesQuerySchema,
  responseSchema: listMessagesResponseSchema,
  summary: 'List thread messages',
  description: 'Returns a paginated list of messages in a conversation thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: (async ({
    mastra,
    agentId,
    threadId,
    resourceId,
    perPage,
    page,
    orderBy,
    include,
    filter,
    includeSystemReminders,
    requestContext,
  }: any) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId });

      if (!effectiveThreadId) {
        throw new HTTPException(400, { message: 'No threadId found' });
      }

      // Gateway proxy: list messages from gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent))) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          // Validate thread ownership before returning messages
          const threadResult = await gwClient.getThread(effectiveThreadId);
          if (threadResult) {
            await validateThreadOwnership(toLocalThread(threadResult.thread), effectiveResourceId);
          }

          const effectivePage = page ?? 0;
          const effectivePerPage = perPage ?? 100;
          const offset = effectivePage * effectivePerPage;
          const result = await gwClient.listMessages(effectiveThreadId, {
            limit: effectivePerPage,
            offset,
            order: orderBy?.direction?.toLowerCase(),
          });
          if (!result) {
            throw new HTTPException(404, { message: 'Thread not found' });
          }
          return {
            messages: result.messages.map(toLocalMessage),
            uiMessages: result.messages.map(toLocalMessage),
          };
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });

      if (memory) {
        const thread = await memory.getThreadById({ threadId: effectiveThreadId });
        if (!thread) {
          throw new HTTPException(404, { message: 'Thread not found' });
        }
        await validateThreadOwnership(thread, effectiveResourceId);

        const result = await memory.recall({
          threadId: effectiveThreadId,
          resourceId: effectiveResourceId,
          perPage,
          page,
          orderBy,
          include,
          filter,
          includeSystemReminders,
        });
        return result;
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        const memoryStore = await storage.getStore('memory');
        if (memoryStore) {
          const thread = await memoryStore.getThreadById({ threadId: effectiveThreadId });
          if (!thread) {
            throw new HTTPException(404, { message: 'Thread not found' });
          }
          await validateThreadOwnership(thread, effectiveResourceId);

          const result = await memoryStore.listMessages({
            threadId: effectiveThreadId,
            resourceId: effectiveResourceId,
            perPage,
            page,
            orderBy,
            include,
            filter,
          });
          return result;
        }
      }

      // Return empty messages when memory is not configured (Issue #11765)
      // This allows the playground UI to gracefully handle agents without memory
      return { messages: [], uiMessages: [] };
    } catch (error) {
      return handleError(error, 'Error getting messages');
    }
  }) as any,
});

export const GET_WORKING_MEMORY_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads/:threadId/working-memory',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: getWorkingMemoryQuerySchema,
  responseSchema: getWorkingMemoryResponseSchema,
  summary: 'Get working memory',
  description: 'Returns the working memory state for a thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, resourceId, requestContext, memoryConfig }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId });

      // Gateway agents: working memory is not a local concept
      const gwAgent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (gwAgent && (await isGatewayAgentAsync(gwAgent)) && getGatewayClient()) {
        return { workingMemory: null, source: 'thread' as const, workingMemoryTemplate: null, threadExists: true };
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (!memory) {
        // Return null working memory when memory is not configured (Issue #11765)
        // This allows the playground UI to gracefully handle agents without memory
        return { workingMemory: null, source: 'thread' as const, workingMemoryTemplate: null, threadExists: false };
      }
      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (thread) {
        await validateThreadOwnership(thread, effectiveResourceId);
      }
      const threadExists = !!thread;
      const template = await memory.getWorkingMemoryTemplate({ memoryConfig });
      const workingMemoryTemplate =
        template?.format === 'json'
          ? { ...template, content: JSON.stringify(generateEmptyFromSchema(template.content)) }
          : template;
      const workingMemory = await memory.getWorkingMemory({
        threadId: effectiveThreadId!,
        resourceId: effectiveResourceId,
        memoryConfig,
      });
      const config = memory.getMergedThreadConfig(memoryConfig || {});
      const source: 'thread' | 'resource' =
        config.workingMemory?.scope !== 'thread' && effectiveResourceId ? 'resource' : 'thread';
      return { workingMemory, source, workingMemoryTemplate, threadExists };
    } catch (error) {
      return handleError(error, 'Error getting working memory');
    }
  },
});

export const SAVE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/save-messages',
  responseType: 'json',
  queryParamSchema: agentIdQuerySchema,
  bodySchema: saveMessagesBodySchema,
  responseSchema: saveMessagesResponseSchema,
  summary: 'Save messages',
  description: 'Saves new messages to memory',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, messages, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      if (!messages) {
        throw new HTTPException(400, { message: 'Messages are required' });
      }

      if (!Array.isArray(messages)) {
        throw new HTTPException(400, { message: 'Messages should be an array' });
      }

      // Validate that all messages have threadId and resourceId
      const invalidMessages = messages.filter(message => !message.threadId || !message.resourceId);
      if (invalidMessages.length > 0) {
        throw new HTTPException(400, {
          message: `All messages must have threadId and resourceId fields. Found ${invalidMessages.length} invalid message(s).`,
        });
      }

      // If effectiveResourceId is set, validate all messages belong to this resource
      if (effectiveResourceId) {
        const unauthorizedMessages = messages.filter(message => message.resourceId !== effectiveResourceId);
        if (unauthorizedMessages.length > 0) {
          throw new HTTPException(403, {
            message: 'Access denied: cannot save messages for a different resource',
          });
        }

        // Validate that all threads belong to this resource (prevents cross-resource data pollution)
        const threadIds = [...new Set(messages.map(m => m.threadId).filter(Boolean))] as string[];
        for (const threadId of threadIds) {
          const thread = await memory.getThreadById({ threadId });
          // Thread may not exist yet (will be created on first message save), which is allowed
          // But if it exists, it must belong to the same resource
          await validateThreadOwnership(thread, effectiveResourceId);
        }
      }

      const processedMessages = messages.map(message => ({
        ...message,
        id: message.id || memory.generateId(),
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      }));

      const result = await memory.saveMessages({ messages: processedMessages as any, memoryConfig: {} });
      return result;
    } catch (error) {
      return handleError(error, 'Error saving messages');
    }
  },
});

export const CREATE_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/threads',
  responseType: 'json',
  queryParamSchema: agentIdQuerySchema,
  bodySchema: createThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Create thread',
  description: 'Creates a new conversation thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, resourceId, title, metadata, threadId, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      // Gateway proxy: create thread via gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent))) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          validateBody({ resourceId: effectiveResourceId });
          const result = await gwClient.createThread({
            id: threadId,
            resourceId: effectiveResourceId!,
            title,
            metadata,
          });
          return toLocalThread(result.thread);
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      validateBody({ resourceId: effectiveResourceId });

      const result = await memory.createThread({
        resourceId: effectiveResourceId!,
        title,
        metadata,
        threadId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error saving thread to memory');
    }
  },
});

export const UPDATE_THREAD_ROUTE = createRoute({
  method: 'PATCH',
  path: '/memory/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: updateThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Update thread',
  description: 'Updates a conversation thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, title, metadata, resourceId, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId });

      // Gateway proxy: update thread via gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent))) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          // Validate ownership before mutating
          const existing = await gwClient.getThread(effectiveThreadId!);
          if (existing) {
            await validateThreadOwnership(toLocalThread(existing.thread), effectiveResourceId);
          }
          const result = await gwClient.updateThread(effectiveThreadId!, { title, metadata });
          if (!result) {
            throw new HTTPException(404, { message: 'Thread not found' });
          }
          return toLocalThread(result.thread);
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      const updatedAt = new Date();

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }
      await validateThreadOwnership(thread, effectiveResourceId);

      const updatedThread = {
        ...thread,
        title: title || thread.title,
        metadata: metadata || thread.metadata,
        // Don't allow changing resourceId if effectiveResourceId is set (prevents reassigning threads)
        resourceId: effectiveResourceId || resourceId || thread.resourceId,
        createdAt: thread.createdAt,
        updatedAt,
      };

      const result = await memory.saveThread({ thread: updatedThread });
      return {
        ...result,
        resourceId: result.resourceId ?? null,
      };
    } catch (error) {
      return handleError(error, 'Error updating thread');
    }
  },
});

export const DELETE_THREAD_ROUTE = createRoute({
  method: 'DELETE',
  path: '/memory/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: deleteThreadQuerySchema,
  responseSchema: deleteThreadResponseSchema,
  summary: 'Delete thread',
  description: 'Deletes a conversation thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, resourceId, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId });

      // Gateway proxy: delete thread via gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent))) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          // Validate ownership before deleting
          const existing = await gwClient.getThread(effectiveThreadId!);
          if (existing) {
            await validateThreadOwnership(toLocalThread(existing.thread), effectiveResourceId);
          }
          const deleteResult = await gwClient.deleteThread(effectiveThreadId!);
          if (!deleteResult.ok) {
            throw new HTTPException(404, { message: 'Thread not found on gateway' });
          }
          return { result: 'Thread deleted' };
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }
      await validateThreadOwnership(thread, effectiveResourceId);

      await memory.deleteThread(effectiveThreadId!);
      return { result: 'Thread deleted' };
    } catch (error) {
      return handleError(error, 'Error deleting thread');
    }
  },
});

export const CLONE_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/threads/:threadId/clone',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: cloneThreadBodySchema,
  responseSchema: cloneThreadResponseSchema,
  summary: 'Clone thread',
  description: 'Creates a copy of a conversation thread with all its messages',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, newThreadId, resourceId, title, metadata, options, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      // Validate source thread ownership
      const sourceThread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!sourceThread) {
        throw new HTTPException(404, { message: 'Source thread not found' });
      }
      await validateThreadOwnership(sourceThread, effectiveResourceId);

      const result = await memory.cloneThread({
        sourceThreadId: effectiveThreadId!,
        newThreadId,
        // Use effective resourceId for the cloned thread
        resourceId: effectiveResourceId,
        title,
        metadata,
        options,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error cloning thread');
    }
  },
});

export const UPDATE_WORKING_MEMORY_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/threads/:threadId/working-memory',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: updateWorkingMemoryBodySchema,
  responseSchema: updateWorkingMemoryResponseSchema,
  summary: 'Update working memory',
  description: 'Updates the working memory state for a thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, resourceId, memoryConfig, workingMemory, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      validateBody({ threadId: effectiveThreadId, workingMemory });

      // Gateway agents: working memory not applicable, no-op
      const gwAgent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (gwAgent && (await isGatewayAgentAsync(gwAgent)) && getGatewayClient()) {
        return { success: true };
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }
      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }
      await validateThreadOwnership(thread, effectiveResourceId);

      await memory.updateWorkingMemory({
        threadId: effectiveThreadId!,
        resourceId: effectiveResourceId,
        workingMemory,
        memoryConfig,
      });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error updating working memory');
    }
  },
});

export const DELETE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/messages/delete',
  responseType: 'json',
  queryParamSchema: deleteMessagesQuerySchema,
  bodySchema: deleteMessagesBodySchema,
  responseSchema: deleteMessagesResponseSchema,
  summary: 'Delete messages',
  description: 'Deletes specific messages from memory',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, resourceId, messageIds, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      if (messageIds === undefined || messageIds === null) {
        throw new HTTPException(400, { message: 'messageIds is required' });
      }

      // Normalize messageIds to the format expected by deleteMessages
      // Convert single values to arrays and extract IDs from objects
      let normalizedIds: string[] | { id: string }[];

      if (Array.isArray(messageIds)) {
        // Already an array - keep as is (could be string[] or { id: string }[])
        normalizedIds = messageIds;
      } else if (typeof messageIds === 'string') {
        // Single string ID - wrap in array
        normalizedIds = [messageIds];
      } else {
        // Single object with id property - wrap in array
        normalizedIds = [messageIds];
      }

      // Extract string IDs for validation and deletion
      const stringIds = normalizedIds.map(id => (typeof id === 'string' ? id : id.id));

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });

      // If effectiveResourceId is set, validate ownership of all messages before deletion
      // Fail closed: if we can't verify ownership, deny deletion
      if (effectiveResourceId && stringIds.length > 0) {
        const storage = memory?.storage || getStorageFromContext({ mastra });
        if (!storage) {
          throw new HTTPException(403, { message: 'Access denied: unable to verify message ownership' });
        }
        const memoryStore = await storage.getStore('memory');
        if (!memoryStore) {
          throw new HTTPException(400, { message: 'Memory is not initialized' });
        }

        // Get messages to find their threads
        const { messages } = await memoryStore.listMessagesById({ messageIds: stringIds });

        // Collect unique thread IDs
        const threadIds = [...new Set(messages.map(m => m.threadId).filter(Boolean))] as string[];

        // Validate ownership of all threads
        for (const threadId of threadIds) {
          const thread = await memoryStore.getThreadById({ threadId });
          if (thread && thread.resourceId && thread.resourceId !== effectiveResourceId) {
            throw new HTTPException(403, {
              message: 'Access denied: message belongs to a thread owned by a different resource',
            });
          }
        }
      }

      if (memory) {
        await memory.deleteMessages(normalizedIds);
      } else {
        // Fallback to storage (covers stored agents whose memory can't be resolved)
        const storage = getStorageFromContext({ mastra });
        if (storage) {
          const memoryStore = await storage.getStore('memory');
          if (memoryStore) {
            await memoryStore.deleteMessages(stringIds);
          } else {
            throw new HTTPException(400, { message: 'Memory is not initialized' });
          }
        } else {
          throw new HTTPException(400, { message: 'Memory is not initialized' });
        }
      }

      // Count messages for response
      const count = Array.isArray(messageIds) ? messageIds.length : 1;

      return { success: true, message: `${count} message${count === 1 ? '' : 's'} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting messages');
    }
  },
});

export const SEARCH_MEMORY_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/search',
  responseType: 'json',
  queryParamSchema: searchMemoryQuerySchema,
  responseSchema: searchMemoryResponseSchema,
  summary: 'Search memory',
  description: 'Searches across memory using semantic or text search',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, searchQuery, resourceId, threadId, limit = 20, requestContext, memoryConfig }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      validateBody({ searchQuery, resourceId: effectiveResourceId });

      // Gateway agents: semantic search not supported via gateway
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent)) && getGatewayClient()) {
        return {
          results: [],
          count: 0,
          query: searchQuery,
          searchScope: 'resource' as const,
          searchType: 'semantic' as const,
        };
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      // Get memory configuration first to check scope
      const config = memory.getMergedThreadConfig(memoryConfig || {});
      const hasSemanticRecall = !!config?.semanticRecall;
      const resourceScope =
        typeof config?.semanticRecall === 'object' ? config?.semanticRecall?.scope !== 'thread' : true;

      const searchResults: SearchResult[] = [];

      // If threadId is provided and scope is thread-based, check if the thread exists
      if (effectiveThreadId && !resourceScope) {
        const thread = await memory.getThreadById({ threadId: effectiveThreadId });
        if (!thread) {
          // Thread doesn't exist yet (new unsaved thread) - return empty results
          return {
            results: [],
            count: 0,
            query: searchQuery,
            searchScope: resourceScope ? 'resource' : 'thread',
            searchType: hasSemanticRecall ? 'semantic' : 'text',
          };
        }
        await validateThreadOwnership(thread, effectiveResourceId);
      }

      // Use effectiveThreadId or find one from the resource
      let searchThreadId = effectiveThreadId;

      // If no threadId provided, get one from the resource
      if (!searchThreadId) {
        const { threads } = await memory.listThreads({
          filter: { resourceId: effectiveResourceId },
          page: 0,
          perPage: 1,
          orderBy: { field: 'updatedAt', direction: 'DESC' },
        });

        if (threads.length === 0) {
          return {
            results: [],
            count: 0,
            query: searchQuery,
            searchScope: resourceScope ? 'resource' : 'thread',
            searchType: hasSemanticRecall ? 'semantic' : 'text',
          };
        }

        // Use first thread - Memory class will handle scope internally
        searchThreadId = threads[0]!.id;
      }

      const beforeRange =
        typeof config.semanticRecall === `boolean`
          ? 2
          : typeof config.semanticRecall?.messageRange === `number`
            ? config.semanticRecall.messageRange
            : config.semanticRecall?.messageRange.before || 2;
      const afterRange =
        typeof config.semanticRecall === `boolean`
          ? 2
          : typeof config.semanticRecall?.messageRange === `number`
            ? config.semanticRecall.messageRange
            : config.semanticRecall?.messageRange.after || 2;

      if (resourceScope && config.semanticRecall) {
        config.semanticRecall =
          typeof config.semanticRecall === `boolean`
            ? // make message range 0 so we can highlight the matches in search, message range will include other messages, not the matching ones
              // and we add prev/next messages in a special section on each message anyway
              { messageRange: 0, topK: 2, scope: 'resource' }
            : { ...config.semanticRecall, messageRange: 0 };
      }

      // Single call to recall - just like the agent does
      // The Memory class handles scope (thread vs resource) internally
      const threadConfig = memory.getMergedThreadConfig(config || {});
      if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
        return { results: [], count: 0, query: searchQuery };
      }

      const result = await memory.recall({
        threadId: searchThreadId,
        resourceId: effectiveResourceId,
        perPage: threadConfig.lastMessages,
        threadConfig: config,
        vectorSearchString: threadConfig.semanticRecall && searchQuery ? searchQuery : undefined,
      });

      // Get all threads to build context and show which thread each message is from
      // Fetch threads by IDs from the actual messages to avoid truncation
      const threadIds = Array.from(
        new Set(result.messages.map((m: MastraDBMessage) => m.threadId || searchThreadId!).filter(Boolean)),
      );
      const fetched = await Promise.all(threadIds.map((id: string) => memory.getThreadById({ threadId: id })));
      const threadMap = new Map(fetched.filter(Boolean).map(t => [t!.id, t!]));

      // Process each message in the results
      for (const msg of result.messages) {
        const content = getTextContent(msg);

        const msgThreadId = msg.threadId || searchThreadId;
        const thread = threadMap.get(msgThreadId);

        // Get thread messages for context
        const threadMessages = (await memory.recall({ threadId: msgThreadId })).messages;
        const messageIndex = threadMessages.findIndex(m => m.id === msg.id);

        const searchResult: SearchResult = {
          id: msg.id,
          role: msg.role,
          content,
          createdAt: msg.createdAt,
          threadId: msgThreadId,
          threadTitle: thread?.title || msgThreadId,
        };

        if (messageIndex !== -1) {
          searchResult.context = {
            before: threadMessages.slice(Math.max(0, messageIndex - beforeRange), messageIndex).map(m => ({
              id: m.id,
              role: m.role,
              content: getTextContent(m),
              createdAt: m.createdAt || new Date(),
            })),
            after: threadMessages.slice(messageIndex + 1, messageIndex + afterRange + 1).map(m => ({
              id: m.id,
              role: m.role,
              content: getTextContent(m),
              createdAt: m.createdAt || new Date(),
            })),
          };
        }

        searchResults.push(searchResult);
      }

      // Sort by date (newest first) and limit
      const sortedResults = searchResults
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      return {
        results: sortedResults,
        count: sortedResults.length,
        query: searchQuery,
        searchScope: resourceScope ? 'resource' : 'thread',
        searchType: hasSemanticRecall ? 'semantic' : 'text',
      };
    } catch (error) {
      return handleError(error, 'Error searching memory');
    }
  },
});

// Network routes (same handlers with /network/ prefix)
export const GET_MEMORY_STATUS_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/network/status',
  responseType: 'json',
  queryParamSchema: getMemoryStatusNetworkQuerySchema,
  responseSchema: memoryStatusResponseSchema,
  summary: 'Get memory status (network)',
  description: 'Returns the current status of the memory system (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: GET_MEMORY_STATUS_ROUTE.handler,
});

export const LIST_THREADS_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/network/threads',
  responseType: 'json',
  queryParamSchema: listThreadsNetworkQuerySchema,
  responseSchema: listThreadsResponseSchema,
  summary: 'List memory threads (network)',
  description: 'Returns a paginated list of conversation threads (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: LIST_THREADS_ROUTE.handler,
});

export const GET_THREAD_BY_ID_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/network/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: getThreadByIdNetworkQuerySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Get thread by ID (network)',
  description: 'Returns details for a specific conversation thread (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: GET_THREAD_BY_ID_ROUTE.handler,
});

export const LIST_MESSAGES_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/network/threads/:threadId/messages',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: listMessagesNetworkQuerySchema,
  responseSchema: listMessagesResponseSchema,
  summary: 'List thread messages (network)',
  description: 'Returns a paginated list of messages in a conversation thread (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: LIST_MESSAGES_ROUTE.handler,
});

export const SAVE_MESSAGES_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/network/save-messages',
  responseType: 'json',
  queryParamSchema: saveMessagesNetworkQuerySchema,
  bodySchema: saveMessagesBodySchema,
  responseSchema: saveMessagesResponseSchema,
  summary: 'Save messages (network)',
  description: 'Saves new messages to memory (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: SAVE_MESSAGES_ROUTE.handler,
});

export const CREATE_THREAD_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/network/threads',
  responseType: 'json',
  queryParamSchema: createThreadNetworkQuerySchema,
  bodySchema: createThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Create thread (network)',
  description: 'Creates a new conversation thread (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: CREATE_THREAD_ROUTE.handler,
});

export const UPDATE_THREAD_NETWORK_ROUTE = createRoute({
  method: 'PATCH',
  path: '/memory/network/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: updateThreadNetworkQuerySchema,
  bodySchema: updateThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Update thread (network)',
  description: 'Updates a conversation thread (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: UPDATE_THREAD_ROUTE.handler,
});

export const DELETE_THREAD_NETWORK_ROUTE = createRoute({
  method: 'DELETE',
  path: '/memory/network/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: deleteThreadNetworkQuerySchema,
  responseSchema: deleteThreadResponseSchema,
  summary: 'Delete thread (network)',
  description: 'Deletes a conversation thread (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: DELETE_THREAD_ROUTE.handler,
});

export const DELETE_MESSAGES_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/network/messages/delete',
  responseType: 'json',
  queryParamSchema: deleteMessagesNetworkQuerySchema,
  bodySchema: deleteMessagesBodySchema,
  responseSchema: deleteMessagesResponseSchema,
  summary: 'Delete messages (network)',
  description: 'Deletes specific messages from memory (network route)',
  tags: ['Memory - Network'],
  requiresAuth: true,
  handler: DELETE_MESSAGES_ROUTE.handler,
});
