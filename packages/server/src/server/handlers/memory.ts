import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/di';
import { assertNoReservedThreadBranchMetadata, createThreadBranchError } from '@mastra/core/memory';
import type { BranchThreadOutput, MastraMemory, StorageThreadType } from '@mastra/core/memory';
import {
  branchThreadWithGeneratedId,
  getThreadBranchAuthorizationCandidates,
  persistGeneratedMessages,
} from '@mastra/core/memory/internal';
import type { MastraStorage, MemoryStorage, StorageListThreadsOutput } from '@mastra/core/storage';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import {
  threadIdPathParams,
  agentIdQuerySchema,
  optionalAgentIdQuerySchema,
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
  branchThreadBodySchema,
  branchThreadResponseSchema,
  getParentThreadResponseSchema,
  listThreadBranchesQuerySchema,
  listThreadBranchesResponseSchema,
  getBranchHistoryResponseSchema,
  transferThreadBodySchema,
  transferThreadResponseSchema,
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
import {
  assertLegacyThreadAvailableOrThrow,
  assertThreadBranchingSupported,
  authorizeMemoryThreadAccess,
  authorizeThreadBranchHistory,
  authorizeThreadBranchTree,
  createMemoryThreadIfAbsent,
  filterThreadsByBranchAccess,
  inspectVisibleMemoryThread,
  sanitizeLegacyThreadListOrThrow,
  sanitizeThreadForResponse,
  throwThreadBranchNotFound,
} from './thread-branching';
import {
  validateBody,
  getEffectiveResourceId,
  getContextResourceId,
  getEffectiveThreadId,
  enforceThreadAccess,
} from './utils';

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

function hasFGAUser(requestContext?: RequestContext): requestContext is RequestContext {
  const user = requestContext?.get('user');
  return !!user && typeof user === 'object';
}

function shouldFilterThreadsWithFGA(mastra: any, requestContext?: RequestContext): requestContext is RequestContext {
  return !!mastra.getServer?.()?.fga && hasFGAUser(requestContext);
}

async function filterAccessibleThreads({
  mastra,
  requestContext,
  threads,
}: {
  mastra: any;
  requestContext?: RequestContext;
  threads: StorageThreadType[];
}): Promise<StorageThreadType[]> {
  const fgaProvider = mastra.getServer?.()?.fga;
  if (!fgaProvider || !hasFGAUser(requestContext) || threads.length === 0) {
    return threads;
  }

  return fgaProvider.filterAccessible(
    requestContext.get('user') as { id: string; [key: string]: unknown },
    threads,
    'thread',
    MastraFGAPermissions.MEMORY_READ,
  );
}

function paginateThreads({
  threads,
  page,
  perPage,
}: {
  threads: StorageThreadType[];
  page?: number;
  perPage?: number | false;
}): StorageListThreadsOutput {
  const effectivePage = page ?? 0;
  const effectivePerPage: number | false = perPage ?? 100;

  if (effectivePerPage === false) {
    return {
      threads,
      page: effectivePage,
      perPage: false,
      total: threads.length,
      hasMore: false,
    };
  }

  const start = effectivePage * effectivePerPage;
  const pagedThreads = threads.slice(start, start + effectivePerPage);

  return {
    threads: pagedThreads,
    page: effectivePage,
    perPage: effectivePerPage,
    total: threads.length,
    hasMore: start + pagedThreads.length < threads.length,
  };
}

async function enforceDeleteMessagesThreadAccess({
  mastra,
  requestContext,
  memory,
  memoryStore,
  messageIds,
  effectiveResourceId,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory?: MastraMemory | null;
  memoryStore: MemoryStorage;
  messageIds: string[];
  effectiveResourceId?: string;
}): Promise<void> {
  const { messages } = await memoryStore.listMessagesById({ messageIds });
  const threadIds = [...new Set(messages.map(m => m.threadId).filter(Boolean))] as string[];

  if (messages.some(message => !message.threadId)) {
    throw new HTTPException(403, { message: 'Access denied: unable to verify message thread access' });
  }

  for (const threadId of threadIds) {
    const thread = await memoryStore.getThreadById({ threadId });
    if (!thread) {
      throw new HTTPException(403, { message: 'Access denied: unable to verify message thread access' });
    }

    if (memory) {
      await authorizeThreadBranchTree({
        mastra,
        requestContext,
        memory,
        thread,
        effectiveResourceId,
        permission: MastraFGAPermissions.MEMORY_DELETE,
      });
    } else {
      const visibleThread = assertLegacyThreadAvailableOrThrow({
        threadId,
        threads: (await memoryStore.listThreads({ perPage: false })).threads,
      });
      await enforceThreadAccess({
        mastra,
        requestContext,
        threadId,
        thread: visibleThread,
        effectiveResourceId,
        permission: MastraFGAPermissions.MEMORY_DELETE,
      });
    }
  }
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

async function authorizeResourceMemoryAccess({
  mastra,
  requestContext,
  memory,
  resourceId,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  resourceId: string;
}): Promise<void> {
  const { threads } = await memory.listThreads({ filter: { resourceId }, perPage: false });
  if (threads.length === 0 && mastra.getServer()?.fga) {
    throwThreadBranchNotFound();
  }
  for (const thread of threads) {
    await authorizeMemoryThreadAccess({
      mastra,
      requestContext,
      memory,
      thread,
      effectiveResourceId: resourceId,
      permission: MastraFGAPermissions.MEMORY_READ,
    });
  }
}

function agentSupportsMemory(agent: Agent | null): boolean {
  if (!agent) return true; // unresolved → storage fallback still applies

  const candidate = agent as Agent & {
    supportsMemory?: () => boolean;
    hasOwnMemory?: () => boolean;
  };

  // Explicit opt-out via duck-typed supportsMemory() (kept as an escape hatch)
  if (typeof candidate.supportsMemory === 'function' && !candidate.supportsMemory()) {
    return false;
  }

  // A resolved agent with no own memory genuinely has memory disabled
  if (typeof candidate.hasOwnMemory === 'function' && !candidate.hasOwnMemory()) {
    return false;
  }

  return true;
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
          const nestedAgent = nestedAgents[agentId];
          if (nestedAgent instanceof Agent) {
            agent = nestedAgent;
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

async function reauthorizeBranchMutationConflict({
  error,
  mastra,
  agentId,
  requestContext,
  resourceId,
  threadIds,
  permission,
}: {
  error: unknown;
  mastra: any;
  agentId?: string;
  requestContext?: RequestContext;
  resourceId?: string;
  threadIds: string[];
  permission: string;
}): Promise<void> {
  if (!error || typeof error !== 'object' || (error as { id?: unknown }).id !== 'BRANCH_MUTATION_CONFLICT') return;
  const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
  if (!memory?.supportsThreadBranching) return;
  for (const threadId of new Set(threadIds)) {
    const state = await inspectVisibleMemoryThread(memory, threadId, { allowCreate: true });
    if (state.state === 'absent') continue;
    const thread = await memory.getThreadById({ threadId });
    if (!thread) throwThreadBranchNotFound();
    await authorizeThreadBranchTree({
      mastra,
      requestContext,
      memory,
      thread,
      effectiveResourceId: getEffectiveResourceId(requestContext, resourceId),
      permission,
    });
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
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
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

          if (effectiveThreadId) {
            const threadResult = await gwClient.getThread(effectiveThreadId);
            if (!threadResult) throwThreadBranchNotFound();
            const gatewayThread = toLocalThread(threadResult.thread);
            const observationResourceId = effectiveResourceId ?? gatewayThread.resourceId;
            const gatewayThreadCount = await gwClient.listThreads({
              resourceId: gatewayThread.resourceId,
              limit: 1,
              offset: 0,
            });
            const gatewayThreads =
              gatewayThreadCount.total > 0
                ? (
                    await gwClient.listThreads({
                      resourceId: gatewayThread.resourceId,
                      limit: gatewayThreadCount.total,
                      offset: 0,
                    })
                  ).threads.map(toLocalThread)
                : [];
            assertLegacyThreadAvailableOrThrow({ threadId: effectiveThreadId, threads: gatewayThreads });
            await enforceThreadAccess({
              mastra,
              requestContext,
              threadId: effectiveThreadId,
              thread: gatewayThread,
              effectiveResourceId: observationResourceId,
            });
            try {
              const { record } = await gwClient.getObservationRecord(effectiveThreadId, observationResourceId);
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
        if (effectiveThreadId) {
          await inspectVisibleMemoryThread(memory, effectiveThreadId);
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          if (!thread) throwThreadBranchNotFound();
          await authorizeMemoryThreadAccess({
            mastra,
            requestContext,
            memory,
            thread,
            effectiveResourceId,
          });
        }

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
          if (omConfig?.enabled && effectiveResourceId && effectiveThreadId) {
            try {
              const omProcessor = await agent.resolveProcessorById('observational-memory', requestContext);
              const record =
                omProcessor && typeof (omProcessor as any).getRecord === 'function'
                  ? await (omProcessor as any).getRecord(effectiveThreadId, effectiveResourceId)
                  : null;
              omStatus = record
                ? {
                    enabled: true,
                    hasRecord: true,
                    originType: record.originType,
                    lastObservedAt: record.lastObservedAt ?? undefined,
                    tokenCount: record.totalTokensObserved,
                    observationTokenCount: record.observationTokenCount,
                    isObserving: record.isObserving,
                    isReflecting: record.isReflecting,
                  }
                : { enabled: true, hasRecord: false };
            } catch {
              omStatus = { enabled: true };
            }
          } else if (omConfig?.enabled) {
            omStatus = { enabled: true };
          }
        }

        return { result: true, memoryType: 'local' as const, observationalMemory: omStatus };
      }

      if (!agentSupportsMemory(agent)) {
        return { result: false };
      }

      // Fallback to storage (covers unresolved/stored agents and the no-agentId case)
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
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      // Gateway OM: proxy to gateway API
      if (await isGatewayAgentAsync(agent)) {
        const gwClient = getGatewayClient();
        if (gwClient && effectiveResourceId && threadId) {
          const threadResult = await gwClient.getThread(threadId);
          if (!threadResult) {
            throwThreadBranchNotFound();
          }
          const gatewayThread = toLocalThread(threadResult.thread);
          const gatewayThreadCount = await gwClient.listThreads({
            resourceId: gatewayThread.resourceId,
            limit: 1,
            offset: 0,
          });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: gatewayThread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          assertLegacyThreadAvailableOrThrow({ threadId, threads: gatewayThreads });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId,
            thread: gatewayThread,
            effectiveResourceId,
          });
          const [recordResult, historyResult] = await Promise.all([
            gwClient.getObservationRecord(threadId, effectiveResourceId),
            gwClient.getObservationHistory(threadId, {
              resourceId: effectiveResourceId,
              limit: historyLimit,
              from,
              to,
              offset,
            }),
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

      if (!effectiveResourceId) {
        throw new HTTPException(400, { message: 'resourceId is required for observational memory lookup' });
      }
      if (threadId) {
        await inspectVisibleMemoryThread(memory, threadId);
        const thread = await memory.getThreadById({ threadId });
        if (!thread) throwThreadBranchNotFound();
        await authorizeMemoryThreadAccess({ mastra, requestContext, memory, thread, effectiveResourceId });
      } else {
        await authorizeResourceMemoryAccess({
          mastra,
          requestContext,
          memory,
          resourceId: effectiveResourceId,
        });
      }

      const omProcessor = await agent.resolveProcessorById('observational-memory', requestContext);
      if (
        !omProcessor ||
        typeof (omProcessor as any).getRecord !== 'function' ||
        typeof (omProcessor as any).getHistory !== 'function'
      ) {
        throw new HTTPException(400, { message: 'Observational Memory processor not available' });
      }
      const record = await (omProcessor as any).getRecord(threadId ?? '', effectiveResourceId);
      const history = await (omProcessor as any).getHistory(
        threadId ?? '',
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
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      // Gateway proxy: poll the gateway OM record until buffering flags clear
      if (await isGatewayAgentAsync(agent)) {
        const gwClient = getGatewayClient();
        if (gwClient && effectiveResourceId && threadId) {
          const threadResult = await gwClient.getThread(threadId);
          if (!threadResult) {
            throwThreadBranchNotFound();
          }
          const gatewayThread = toLocalThread(threadResult.thread);
          const gatewayThreadCount = await gwClient.listThreads({
            resourceId: gatewayThread.resourceId,
            limit: 1,
            offset: 0,
          });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: gatewayThread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          assertLegacyThreadAvailableOrThrow({ threadId, threads: gatewayThreads });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId,
            thread: gatewayThread,
            effectiveResourceId,
          });
          const maxWaitMs = 30_000;
          const pollIntervalMs = 1_000;
          const deadline = Date.now() + maxWaitMs;

          let record: ReturnType<typeof toLocalOMRecord> | null = null;
          while (Date.now() < deadline) {
            const result = await gwClient.getObservationRecord(threadId, effectiveResourceId);
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

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not configured for this agent' });
      }
      if (!effectiveResourceId) {
        throw new HTTPException(400, { message: 'resourceId is required' });
      }
      if (threadId) {
        await inspectVisibleMemoryThread(memory, threadId);
        const thread = await memory.getThreadById({ threadId });
        if (!thread) throwThreadBranchNotFound();
        await authorizeMemoryThreadAccess({ mastra, requestContext, memory, thread, effectiveResourceId });
      } else {
        await authorizeResourceMemoryAccess({
          mastra,
          requestContext,
          memory,
          resourceId: effectiveResourceId,
        });
      }

      // Resolve the OM processor to call waitForBuffering
      const omProcessor = await agent.resolveProcessorById('observational-memory', requestContext);
      if (
        !omProcessor ||
        typeof (omProcessor as any).waitForBuffering !== 'function' ||
        typeof (omProcessor as any).getRecord !== 'function'
      ) {
        throw new HTTPException(400, { message: 'Observational Memory processor not available' });
      }

      // Block until buffering completes (30s timeout)
      await (omProcessor as any).waitForBuffering(threadId, effectiveResourceId);
      const record = await (omProcessor as any).getRecord(threadId ?? '', effectiveResourceId);

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
          const initialResult = await gwClient.listThreads({
            resourceId: effectiveResourceId,
            limit: 1,
            offset: 0,
          });
          const allThreads =
            initialResult.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: effectiveResourceId,
                    limit: initialResult.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          const authorizedThreads = shouldFilterThreadsWithFGA(mastra, requestContext)
            ? await filterAccessibleThreads({ mastra, requestContext, threads: allThreads })
            : allThreads;
          return paginateThreads({
            threads: sanitizeLegacyThreadListOrThrow(authorizedThreads),
            page,
            perPage,
          });
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
        const result = await memory.listThreads({ filter, perPage: false, orderBy });
        const authorizedThreads = shouldFilterThreadsWithFGA(mastra, requestContext)
          ? await filterAccessibleThreads({ mastra, requestContext, threads: result.threads })
          : result.threads;
        const ancestryAuthorizedThreads = await filterThreadsByBranchAccess({
          mastra,
          requestContext,
          memory,
          threads: authorizedThreads,
          effectiveResourceId,
        });
        return paginateThreads({
          threads: memory.supportsThreadBranching
            ? ancestryAuthorizedThreads.map(sanitizeThreadForResponse)
            : sanitizeLegacyThreadListOrThrow(ancestryAuthorizedThreads),
          page,
          perPage,
        });
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        const memoryStore = await storage.getStore('memory');
        if (memoryStore) {
          const result = await memoryStore.listThreads({ filter, perPage: false, orderBy });
          const authorizedThreads = shouldFilterThreadsWithFGA(mastra, requestContext)
            ? await filterAccessibleThreads({ mastra, requestContext, threads: result.threads })
            : result.threads;
          return paginateThreads({
            threads: sanitizeLegacyThreadListOrThrow(authorizedThreads),
            page,
            perPage,
          });
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
            throwThreadBranchNotFound();
          }
          const thread = toLocalThread(result.thread);
          const gatewayThreadCount = await gwClient.listThreads({ resourceId: thread.resourceId, limit: 1, offset: 0 });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: thread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          assertLegacyThreadAvailableOrThrow({ threadId: effectiveThreadId!, threads: gatewayThreads });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId!,
            thread,
            effectiveResourceId,
          });
          return sanitizeThreadForResponse(thread);
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (memory) {
        await inspectVisibleMemoryThread(memory, effectiveThreadId!);
        const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
        if (!thread) throwThreadBranchNotFound();
        const visibleThread = memory.supportsThreadBranching
          ? sanitizeThreadForResponse(thread)
          : assertLegacyThreadAvailableOrThrow({
              threadId: effectiveThreadId!,
              threads: (await memory.listThreads({ perPage: false })).threads,
            });
        await authorizeMemoryThreadAccess({
          mastra,
          requestContext,
          memory,
          thread: visibleThread,
          effectiveResourceId,
        });
        return visibleThread;
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        const memoryStore = await storage.getStore('memory');
        if (memoryStore) {
          const thread = assertLegacyThreadAvailableOrThrow({
            threadId: effectiveThreadId!,
            threads: (await memoryStore.listThreads({ perPage: false })).threads,
          });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId!,
            thread,
            effectiveResourceId,
          });
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
          if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
            throw new HTTPException(501, {
              message:
                'Gateway memory message metadata filters are not supported by this gateway endpoint. Remove filter.metadata or query a local memory store.',
            });
          }

          // Validate thread ownership before returning messages
          const threadResult = await gwClient.getThread(effectiveThreadId);
          if (!threadResult) {
            throwThreadBranchNotFound();
          }
          const gatewayThread = toLocalThread(threadResult.thread);
          const gatewayThreadCount = await gwClient.listThreads({
            resourceId: gatewayThread.resourceId,
            limit: 1,
            offset: 0,
          });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: gatewayThread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          assertLegacyThreadAvailableOrThrow({ threadId: effectiveThreadId, threads: gatewayThreads });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId,
            thread: gatewayThread,
            effectiveResourceId,
          });

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
        await inspectVisibleMemoryThread(memory, effectiveThreadId);
        const thread = await memory.getThreadById({ threadId: effectiveThreadId });
        if (!thread) throwThreadBranchNotFound();
        await authorizeMemoryThreadAccess({
          mastra,
          requestContext,
          memory,
          thread,
          effectiveResourceId,
        });

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
        const uiMessages = (result as { uiMessages?: unknown }).uiMessages;
        return {
          ...result,
          uiMessages: Array.isArray(uiMessages) ? uiMessages : null,
        };
      }

      // Fallback to storage (covers stored agents whose memory can't be resolved)
      const storage = getStorageFromContext({ mastra });
      if (storage) {
        const memoryStore = await storage.getStore('memory');
        if (memoryStore) {
          const thread = assertLegacyThreadAvailableOrThrow({
            threadId: effectiveThreadId,
            threads: (await memoryStore.listThreads({ perPage: false })).threads,
          });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId,
            thread,
            effectiveResourceId,
          });

          const result = await memoryStore.listMessages({
            threadId: effectiveThreadId,
            resourceId: effectiveResourceId,
            perPage,
            page,
            orderBy,
            include,
            filter,
          });
          return {
            ...result,
            uiMessages: null,
          };
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

      // Gateway agents: working memory is not a local concept, but thread visibility and access still apply.
      const gwAgent = await getAgentFromContext({ mastra, agentId, requestContext });
      const gwClient = getGatewayClient();
      if (gwAgent && (await isGatewayAgentAsync(gwAgent)) && gwClient) {
        const threadResult = await gwClient.getThread(effectiveThreadId!);
        if (!threadResult) throwThreadBranchNotFound();
        const gatewayThread = toLocalThread(threadResult.thread);
        const gatewayThreadCount = await gwClient.listThreads({
          resourceId: gatewayThread.resourceId,
          limit: 1,
          offset: 0,
        });
        const gatewayThreads =
          gatewayThreadCount.total > 0
            ? (
                await gwClient.listThreads({
                  resourceId: gatewayThread.resourceId,
                  limit: gatewayThreadCount.total,
                  offset: 0,
                })
              ).threads.map(toLocalThread)
            : [];
        const visibleThread = assertLegacyThreadAvailableOrThrow({
          threadId: effectiveThreadId!,
          threads: gatewayThreads,
        });
        await enforceThreadAccess({
          mastra,
          requestContext,
          threadId: effectiveThreadId!,
          thread: visibleThread,
          effectiveResourceId,
        });
        return { workingMemory: null, source: 'thread' as const, workingMemoryTemplate: null, threadExists: true };
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (!memory) {
        // Return null working memory when memory is not configured (Issue #11765)
        // This allows the playground UI to gracefully handle agents without memory
        return { workingMemory: null, source: 'thread' as const, workingMemoryTemplate: null, threadExists: false };
      }
      const branchState = await inspectVisibleMemoryThread(memory, effectiveThreadId!, { allowCreate: true });
      const thread =
        branchState.state === 'absent' ? null : await memory.getThreadById({ threadId: effectiveThreadId! });
      const config = memory.getMergedThreadConfig(memoryConfig || {});
      const source: 'thread' | 'resource' =
        config.workingMemory?.scope !== 'thread' && effectiveResourceId ? 'resource' : 'thread';
      if (thread) {
        await authorizeMemoryThreadAccess({ mastra, requestContext, memory, thread, effectiveResourceId });
      } else if (source === 'resource') {
        await enforceThreadAccess({
          mastra,
          requestContext,
          threadId: effectiveThreadId!,
          thread,
          effectiveResourceId,
        });
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

      // The body schema is intentionally permissive (unknown[]); narrow to the
      // fields this handler validates and normalizes.
      const incomingMessages = messages as Array<
        { id?: string; threadId?: string; resourceId?: string; createdAt?: string | Date } & Record<string, unknown>
      >;

      const resourceIdByThread = new Map<string, string>();
      for (const message of incomingMessages) {
        if (!message.threadId || !message.resourceId) {
          continue;
        }
        const existingResourceId = resourceIdByThread.get(message.threadId);
        if (!existingResourceId) {
          resourceIdByThread.set(message.threadId, message.resourceId);
        } else if (existingResourceId !== message.resourceId) {
          throw new HTTPException(400, {
            message: 'All messages for the same threadId must use the same resourceId.',
          });
        }
      }

      // Validate that all messages have threadId and resourceId
      const invalidMessages = incomingMessages.filter(message => !message.threadId || !message.resourceId);
      if (invalidMessages.length > 0) {
        throw new HTTPException(400, {
          message: `All messages must have threadId and resourceId fields. Found ${invalidMessages.length} invalid message(s).`,
        });
      }

      // If effectiveResourceId is set, validate all messages belong to this resource
      if (effectiveResourceId) {
        const unauthorizedMessages = incomingMessages.filter(message => message.resourceId !== effectiveResourceId);
        if (unauthorizedMessages.length > 0) {
          throw new HTTPException(403, {
            message: 'Access denied: cannot save messages for a different resource',
          });
        }
      }

      const threadIds = [...new Set(incomingMessages.map(message => message.threadId!))];
      for (const threadId of threadIds) {
        const branchState = await inspectVisibleMemoryThread(memory, threadId, { allowCreate: true });
        const thread = branchState.state === 'absent' ? null : await memory.getThreadById({ threadId });
        const threadResourceId = effectiveResourceId ?? resourceIdByThread.get(threadId);
        if (thread) {
          await authorizeThreadBranchTree({
            mastra,
            requestContext,
            memory,
            thread,
            effectiveResourceId: threadResourceId,
            permission: MastraFGAPermissions.MEMORY_WRITE,
          });
        } else {
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId,
            thread,
            effectiveResourceId: threadResourceId,
            permission: MastraFGAPermissions.MEMORY_WRITE,
          });
        }
      }

      const generatedMessageIds: string[] = [];
      const processedMessages = incomingMessages.map(message => {
        const id = message.id || memory.generateId();
        const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();
        if (Number.isNaN(createdAt.getTime())) {
          throw createThreadBranchError('BRANCH_INVALID_REQUEST', `Message "${id}" has an invalid createdAt value.`);
        }
        if (message.createdAt === undefined) {
          generatedMessageIds.push(id);
        }
        return { ...message, id, createdAt };
      });

      const result = await persistGeneratedMessages(
        memory,
        { messages: processedMessages as any, memoryConfig: {} },
        generatedMessageIds,
      );
      return result;
    } catch (error) {
      await reauthorizeBranchMutationConflict({
        error,
        mastra,
        agentId,
        requestContext,
        threadIds: Array.isArray(messages)
          ? messages.flatMap(message =>
              message && typeof message === 'object' && typeof (message as { threadId?: unknown }).threadId === 'string'
                ? [(message as { threadId: string }).threadId]
                : [],
            )
          : [],
        permission: MastraFGAPermissions.MEMORY_WRITE,
      });
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
      const effectiveThreadId = threadId ?? mastra.generateId();
      validateBody({ resourceId: effectiveResourceId });
      assertNoReservedThreadBranchMetadata(metadata);

      // Gateway proxy: create thread via gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent))) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          const existing = await gwClient.getThread(effectiveThreadId);
          if (existing) {
            const existingThread = toLocalThread(existing.thread);
            const gatewayThreadCount = await gwClient.listThreads({
              resourceId: existingThread.resourceId,
              limit: 1,
              offset: 0,
            });
            const gatewayThreads =
              gatewayThreadCount.total > 0
                ? (
                    await gwClient.listThreads({
                      resourceId: existingThread.resourceId,
                      limit: gatewayThreadCount.total,
                      offset: 0,
                    })
                  ).threads.map(toLocalThread)
                : [];
            const visibleThread = assertLegacyThreadAvailableOrThrow({
              threadId: effectiveThreadId,
              threads: gatewayThreads,
            });
            await enforceThreadAccess({
              mastra,
              requestContext,
              threadId: effectiveThreadId,
              thread: visibleThread,
              effectiveResourceId,
              permission: MastraFGAPermissions.MEMORY_WRITE,
            });
            throw createThreadBranchError('BRANCH_MUTATION_CONFLICT', 'A thread with the requested ID already exists.');
          }
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId,
            effectiveResourceId,
            permission: MastraFGAPermissions.MEMORY_WRITE,
          });
          const result = await gwClient.createThread({
            id: effectiveThreadId,
            resourceId: effectiveResourceId!,
            title,
            metadata,
          });
          return sanitizeThreadForResponse(toLocalThread(result.thread));
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }
      const branchState = await inspectVisibleMemoryThread(memory, effectiveThreadId, { allowCreate: true });
      if (branchState.state !== 'absent') {
        const existing = await memory.getThreadById({ threadId: effectiveThreadId });
        if (!existing) throwThreadBranchNotFound();
        await authorizeThreadBranchTree({
          mastra,
          requestContext,
          memory,
          thread: existing,
          effectiveResourceId,
          permission: MastraFGAPermissions.MEMORY_WRITE,
        });
        throw createThreadBranchError('BRANCH_MUTATION_CONFLICT', 'A thread with the requested ID already exists.');
      }
      await enforceThreadAccess({
        mastra,
        requestContext,
        threadId: effectiveThreadId,
        effectiveResourceId,
        permission: MastraFGAPermissions.MEMORY_WRITE,
      });

      const result = await createMemoryThreadIfAbsent(memory, {
        resourceId: effectiveResourceId!,
        title,
        metadata,
        threadId: effectiveThreadId,
      });
      return sanitizeThreadForResponse(result);
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
      assertNoReservedThreadBranchMetadata(metadata);

      // Gateway proxy: update thread via gateway API
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      if (agent && (await isGatewayAgentAsync(agent))) {
        const gwClient = getGatewayClient();
        if (gwClient) {
          // Validate ownership before mutating
          const existing = await gwClient.getThread(effectiveThreadId!);
          if (!existing) throwThreadBranchNotFound();
          const gatewayThread = toLocalThread(existing.thread);
          const gatewayThreadCount = await gwClient.listThreads({
            resourceId: gatewayThread.resourceId,
            limit: 1,
            offset: 0,
          });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: gatewayThread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          assertLegacyThreadAvailableOrThrow({ threadId: effectiveThreadId!, threads: gatewayThreads });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId!,
            thread: gatewayThread,
            effectiveResourceId,
            permission: MastraFGAPermissions.MEMORY_WRITE,
          });
          const result = await gwClient.updateThread(effectiveThreadId!, { title, metadata });
          if (!result) {
            throw new HTTPException(404, { message: 'Thread not found' });
          }
          return sanitizeThreadForResponse(toLocalThread(result.thread));
        }
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      const updatedAt = new Date();

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      await inspectVisibleMemoryThread(memory, effectiveThreadId!);
      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!thread) throwThreadBranchNotFound();
      await authorizeThreadBranchTree({
        mastra,
        requestContext,
        memory,
        thread,
        effectiveResourceId,
        permission: MastraFGAPermissions.MEMORY_WRITE,
      });

      const updatedThread = {
        ...thread,
        title: title !== undefined ? title : thread.title,
        metadata: metadata !== undefined ? metadata : thread.metadata,
        // Don't allow changing resourceId if effectiveResourceId is set (prevents reassigning threads)
        resourceId: effectiveResourceId || resourceId || thread.resourceId,
        createdAt: thread.createdAt,
        updatedAt,
      };

      const result = await memory.saveThread({ thread: updatedThread });
      return sanitizeThreadForResponse({
        ...result,
        resourceId: result.resourceId ?? null,
      });
    } catch (error) {
      await reauthorizeBranchMutationConflict({
        error,
        mastra,
        agentId,
        requestContext,
        resourceId,
        threadIds: [getEffectiveThreadId(requestContext, threadId)!],
        permission: MastraFGAPermissions.MEMORY_WRITE,
      });
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
          if (!existing) throwThreadBranchNotFound();
          const gatewayThread = toLocalThread(existing.thread);
          const gatewayThreadCount = await gwClient.listThreads({
            resourceId: gatewayThread.resourceId,
            limit: 1,
            offset: 0,
          });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gwClient.listThreads({
                    resourceId: gatewayThread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          assertLegacyThreadAvailableOrThrow({ threadId: effectiveThreadId!, threads: gatewayThreads });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId!,
            thread: gatewayThread,
            effectiveResourceId,
            permission: MastraFGAPermissions.MEMORY_DELETE,
          });
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

      await inspectVisibleMemoryThread(memory, effectiveThreadId!);
      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!thread) throwThreadBranchNotFound();
      await authorizeThreadBranchTree({
        mastra,
        requestContext,
        memory,
        thread,
        effectiveResourceId,
        permission: MastraFGAPermissions.MEMORY_DELETE,
      });

      await memory.deleteThread(effectiveThreadId!);
      return { result: 'Thread deleted' };
    } catch (error) {
      await reauthorizeBranchMutationConflict({
        error,
        mastra,
        agentId,
        requestContext,
        resourceId,
        threadIds: [getEffectiveThreadId(requestContext, threadId)!],
        permission: MastraFGAPermissions.MEMORY_DELETE,
      });
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
      const effectiveNewThreadId = newThreadId ?? mastra.generateId();
      validateBody({ threadId: effectiveThreadId });
      assertNoReservedThreadBranchMetadata(metadata);

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      // Validate source thread ownership and destination availability.
      await inspectVisibleMemoryThread(memory, effectiveThreadId!);
      const sourceThread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!sourceThread) throwThreadBranchNotFound();
      const cloneResourceId = effectiveResourceId ?? sourceThread.resourceId ?? undefined;
      await authorizeMemoryThreadAccess({
        mastra,
        requestContext,
        memory,
        thread: sourceThread,
        effectiveResourceId,
      });
      const destinationState = await inspectVisibleMemoryThread(memory, effectiveNewThreadId, { allowCreate: true });
      if (destinationState.state === 'absent') {
        await enforceThreadAccess({
          mastra,
          requestContext,
          threadId: effectiveNewThreadId,
          effectiveResourceId: cloneResourceId,
          permission: MastraFGAPermissions.MEMORY_WRITE,
        });
      } else {
        const destinationThread = await memory.getThreadById({ threadId: effectiveNewThreadId });
        if (!destinationThread) throwThreadBranchNotFound();
        await authorizeThreadBranchTree({
          mastra,
          requestContext,
          memory,
          thread: destinationThread,
          effectiveResourceId: cloneResourceId,
          permission: MastraFGAPermissions.MEMORY_WRITE,
        });
        throw createThreadBranchError('BRANCH_MUTATION_CONFLICT', 'A thread with the requested ID already exists.');
      }
      const result = await memory.cloneThread({
        sourceThreadId: effectiveThreadId!,
        newThreadId: effectiveNewThreadId,
        resourceId: cloneResourceId,
        title,
        metadata,
        options,
      });

      return { ...result, thread: sanitizeThreadForResponse(result.thread) };
    } catch (error) {
      return handleError(error, 'Error cloning thread');
    }
  },
});

export const BRANCH_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/threads/:threadId/branch',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: optionalAgentIdQuerySchema,
  bodySchema: branchThreadBodySchema,
  responseSchema: branchThreadResponseSchema,
  summary: 'Branch thread',
  description: 'Creates a shared-history child thread at an inclusive message boundary',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, branchPointMessageId, title, metadata, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      validateBody({ threadId: effectiveThreadId, branchPointMessageId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (!memory) {
        throw createThreadBranchError('BRANCHING_UNSUPPORTED', 'Thread branching requires a configured memory.');
      }
      assertThreadBranchingSupported(memory);

      const sourceThread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!sourceThread) {
        throwThreadBranchNotFound();
      }
      const effectiveResourceId = getEffectiveResourceId(requestContext, sourceThread.resourceId ?? undefined);
      await authorizeThreadBranchHistory({
        mastra,
        requestContext,
        memory,
        threadId: effectiveThreadId!,
        effectiveResourceId,
        currentPermission: MastraFGAPermissions.MEMORY_WRITE,
      });
      for (let attempt = 0; attempt < 5; attempt++) {
        const childThreadId = mastra.generateId();
        await enforceThreadAccess({
          mastra,
          requestContext,
          threadId: childThreadId,
          effectiveResourceId,
          permission: MastraFGAPermissions.MEMORY_WRITE,
        });
        if (await memory.getThreadById({ threadId: childThreadId })) {
          continue;
        }

        try {
          const result = await branchThreadWithGeneratedId(memory, {
            threadId: effectiveThreadId!,
            branchPointMessageId,
            generatedThreadId: childThreadId,
            title,
            metadata,
          });
          return { ...result, thread: sanitizeThreadForResponse(result.thread) };
        } catch (error) {
          const isIdCollision =
            error &&
            typeof error === 'object' &&
            (error as { id?: unknown }).id === 'BRANCH_MUTATION_CONFLICT' &&
            error instanceof Error &&
            error.message.startsWith('Unable to allocate a unique branch thread ID');
          if (!isIdCollision) {
            throw error;
          }
        }
      }
      throw createThreadBranchError('BRANCH_MUTATION_CONFLICT', 'Could not generate a unique branch thread id.');
    } catch (error) {
      return handleError(error, 'Error branching thread');
    }
  },
});

export const GET_PARENT_THREAD_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads/:threadId/parent',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: optionalAgentIdQuerySchema,
  responseSchema: getParentThreadResponseSchema,
  summary: 'Get parent thread',
  description: 'Returns the direct parent of a shared-history thread, or null for a root',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
      validateBody({ threadId: effectiveThreadId });
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (!memory) {
        throw createThreadBranchError('BRANCHING_UNSUPPORTED', 'Thread branching requires a configured memory.');
      }

      const { history } = await authorizeThreadBranchHistory({
        mastra,
        requestContext,
        memory,
        threadId: effectiveThreadId!,
        effectiveResourceId,
      });
      return history.length > 1 ? history.at(-2)!.thread : null;
    } catch (error) {
      return handleError(error, 'Error getting parent thread');
    }
  },
});

export const LIST_THREAD_BRANCHES_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads/:threadId/branches',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: listThreadBranchesQuerySchema,
  responseSchema: listThreadBranchesResponseSchema,
  summary: 'List thread branches',
  description: 'Lists the accessible direct shared-history children of a thread',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, page, perPage, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
      validateBody({ threadId: effectiveThreadId });
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (!memory) {
        throw createThreadBranchError('BRANCHING_UNSUPPORTED', 'Thread branching requires a configured memory.');
      }

      await authorizeThreadBranchHistory({
        mastra,
        requestContext,
        memory,
        threadId: effectiveThreadId!,
        effectiveResourceId,
      });
      const candidates = await getThreadBranchAuthorizationCandidates(memory, effectiveThreadId!, 'children');
      const accessible: BranchThreadOutput[] = [];
      for (const candidate of candidates) {
        if (candidate.id === effectiveThreadId) continue;
        try {
          const history = await authorizeThreadBranchHistory({
            mastra,
            requestContext,
            memory,
            threadId: candidate.id,
            effectiveResourceId,
          });
          const child = history.history.at(-1);
          if (!child?.branch || child.branch.parentThreadId !== effectiveThreadId) continue;
          accessible.push({ thread: child.thread, branch: child.branch });
        } catch (error) {
          if (error && typeof error === 'object' && (error as { id?: unknown }).id === 'BRANCH_NOT_FOUND') {
            continue;
          }
          throw error;
        }
      }
      accessible.sort(
        (left, right) =>
          left.thread.createdAt.getTime() - right.thread.createdAt.getTime() ||
          left.thread.id.localeCompare(right.thread.id),
      );

      const effectivePage = page ?? 0;
      const effectivePerPage = perPage ?? 100;
      const branches =
        effectivePerPage === false
          ? accessible
          : accessible.slice(effectivePage * effectivePerPage, (effectivePage + 1) * effectivePerPage);
      return {
        branches,
        page: effectivePage,
        perPage: effectivePerPage,
        total: accessible.length,
        hasMore: effectivePerPage === false ? false : (effectivePage + 1) * effectivePerPage < accessible.length,
      };
    } catch (error) {
      return handleError(error, 'Error listing thread branches');
    }
  },
});

export const GET_BRANCH_HISTORY_ROUTE = createRoute({
  method: 'GET',
  path: '/memory/threads/:threadId/branch-history',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: optionalAgentIdQuerySchema,
  responseSchema: getBranchHistoryResponseSchema,
  summary: 'Get branch history',
  description: 'Returns the accessible root-to-current shared-history thread path',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
      validateBody({ threadId: effectiveThreadId });
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      if (!memory) {
        throw createThreadBranchError('BRANCHING_UNSUPPORTED', 'Thread branching requires a configured memory.');
      }
      return await authorizeThreadBranchHistory({
        mastra,
        requestContext,
        memory,
        threadId: effectiveThreadId!,
        effectiveResourceId,
      });
    } catch (error) {
      return handleError(error, 'Error getting branch history');
    }
  },
});

export const TRANSFER_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/memory/threads/:threadId/transfer',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: optionalAgentIdQuerySchema,
  bodySchema: transferThreadBodySchema,
  responseSchema: transferThreadResponseSchema,
  summary: 'Transfer thread ownership',
  description:
    'Reassigns a thread and all of its messages to a different resource. Requires a privileged (non-resource-scoped) context.',
  tags: ['Memory'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, resourceId, requestContext }) => {
    try {
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);
      validateBody({ threadId: effectiveThreadId });

      // Privilege gate: a resource-scoped caller (user/tenant) must not reassign ownership.
      const scopeId = getContextResourceId(requestContext);
      if (scopeId) {
        throw new HTTPException(403, {
          message: 'Thread transfer requires a privileged (non-resource-scoped) context',
        });
      }

      // Without a resource scope we can only authorize the transfer through FGA. If
      // `server.auth` is configured but there is no FGA provider to authorize the
      // caller, an unscoped request would otherwise be treated as privileged, which
      // would let any authenticated caller reassign ownership. Reject that state
      // rather than granting an implicit privilege.
      const server = mastra.getServer?.();
      if (server?.auth && !server?.fga) {
        throw new HTTPException(403, {
          message:
            'Thread transfer requires explicit authorization. Configure an FGA provider (memory:write) to authorize privileged, non-resource-scoped transfers.',
        });
      }

      // Intentional: when neither `server.auth` nor `server.fga` is configured the
      // entire memory API is open by design (an unauthenticated server already exposes
      // thread update/delete). Transfer grants no capability an attacker on such a
      // server lacks, so an unscoped context is treated as privileged here — matching
      // sibling mutation routes rather than adding a route-specific restriction.

      const agent = agentId ? await getAgentFromContext({ mastra, agentId, requestContext }) : undefined;
      if (agent && (await isGatewayAgentAsync(agent))) {
        throw new HTTPException(501, { message: 'Thread transfer is not supported for gateway agents' });
      }

      // Resolve either the agent's memory or, for agent-less (storage-backed) memory,
      // the memory store directly so a transfer without an `agentId` still works.
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
      const memoryStore = memory ? undefined : await getStorageFromContext({ mastra })?.getStore('memory');
      if (!memory && !memoryStore) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const sourceThread = memory
        ? await memory.getThreadById({ threadId: effectiveThreadId! })
        : await memoryStore!.getThreadById({ threadId: effectiveThreadId! });
      if (!sourceThread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }

      // Privileged context: ownership check is a no-op, but FGA MEMORY_WRITE still applies when configured.
      if (memory) {
        await authorizeThreadBranchTree({
          mastra,
          requestContext,
          memory,
          thread: sourceThread,
          effectiveResourceId: undefined,
          permission: MastraFGAPermissions.MEMORY_WRITE,
        });
      } else {
        const visibleThread = assertLegacyThreadAvailableOrThrow({
          threadId: effectiveThreadId!,
          threads: (await memoryStore!.listThreads({ perPage: false })).threads,
        });
        await enforceThreadAccess({
          mastra,
          requestContext,
          threadId: effectiveThreadId!,
          thread: visibleThread,
          effectiveResourceId: undefined,
          permission: MastraFGAPermissions.MEMORY_WRITE,
        });
      }

      const result = memory
        ? await memory.updateThreadResourceId({ threadId: effectiveThreadId!, resourceId })
        : await memoryStore!.updateThreadResourceId({ threadId: effectiveThreadId!, resourceId });

      return sanitizeThreadForResponse({ ...result, resourceId: result.resourceId ?? null });
    } catch (error) {
      return handleError(error, 'Error transferring thread');
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
      await inspectVisibleMemoryThread(memory, effectiveThreadId!);
      const thread = await memory.getThreadById({ threadId: effectiveThreadId! });
      if (!thread) throwThreadBranchNotFound();
      await authorizeThreadBranchTree({
        mastra,
        requestContext,
        memory,
        thread,
        effectiveResourceId,
        permission: MastraFGAPermissions.MEMORY_WRITE,
      });

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

        await enforceDeleteMessagesThreadAccess({
          mastra,
          requestContext,
          memory,
          memoryStore,
          messageIds: stringIds,
          effectiveResourceId,
        });
      } else if (stringIds.length > 0) {
        const storage = memory?.storage || getStorageFromContext({ mastra });
        if (!storage) {
          throw new HTTPException(400, { message: 'Memory is not initialized' });
        }
        const memoryStore = await storage.getStore('memory');
        if (!memoryStore) {
          throw new HTTPException(400, { message: 'Memory is not initialized' });
        }
        await enforceDeleteMessagesThreadAccess({
          mastra,
          requestContext,
          memory,
          memoryStore,
          messageIds: stringIds,
        });
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
      if (error && typeof error === 'object' && (error as { id?: unknown }).id === 'BRANCH_MUTATION_CONFLICT') {
        const memory = await getMemoryFromContext({ mastra, agentId, requestContext, allowMissingAgent: true });
        const storage = memory?.storage ?? getStorageFromContext({ mastra });
        const memoryStore = await storage?.getStore('memory');
        const ids = (Array.isArray(messageIds) ? messageIds : [messageIds]).flatMap(value =>
          typeof value === 'string' ? [value] : value && typeof value.id === 'string' ? [value.id] : [],
        );
        const { messages: storedMessages } = memoryStore
          ? await memoryStore.listMessagesById({ messageIds: ids })
          : { messages: [] };
        await reauthorizeBranchMutationConflict({
          error,
          mastra,
          agentId,
          requestContext,
          resourceId,
          threadIds: storedMessages.flatMap(message => (message.threadId ? [message.threadId] : [])),
          permission: MastraFGAPermissions.MEMORY_DELETE,
        });
      }
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

      // Gateway agents: semantic search is unavailable, but an explicit thread must still be visible and authorized.
      const agent = await getAgentFromContext({ mastra, agentId, requestContext });
      const gatewayClient = getGatewayClient();
      if (agent && (await isGatewayAgentAsync(agent)) && gatewayClient) {
        if (effectiveThreadId) {
          const threadResult = await gatewayClient.getThread(effectiveThreadId);
          if (!threadResult) throwThreadBranchNotFound();
          const gatewayThread = toLocalThread(threadResult.thread);
          const gatewayThreadCount = await gatewayClient.listThreads({
            resourceId: gatewayThread.resourceId,
            limit: 1,
            offset: 0,
          });
          const gatewayThreads =
            gatewayThreadCount.total > 0
              ? (
                  await gatewayClient.listThreads({
                    resourceId: gatewayThread.resourceId,
                    limit: gatewayThreadCount.total,
                    offset: 0,
                  })
                ).threads.map(toLocalThread)
              : [];
          const visibleThread = assertLegacyThreadAvailableOrThrow({
            threadId: effectiveThreadId,
            threads: gatewayThreads,
          });
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId: effectiveThreadId,
            thread: visibleThread,
            effectiveResourceId,
          });
        }
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
      let accessibleThreadsForResource: StorageThreadType[] | undefined;
      let accessibleThreadIds: Set<string> | undefined;

      if (effectiveResourceId && (resourceScope || !effectiveThreadId)) {
        const { threads } = await memory.listThreads({
          filter: { resourceId: effectiveResourceId },
          perPage: false,
          orderBy: { field: 'updatedAt', direction: 'DESC' },
        });
        const authorizedThreads = shouldFilterThreadsWithFGA(mastra, requestContext)
          ? await filterAccessibleThreads({ mastra, requestContext, threads })
          : threads;

        if (memory.supportsThreadBranching) {
          accessibleThreadsForResource = [];
          for (const thread of authorizedThreads) {
            try {
              const history = await authorizeThreadBranchHistory({
                mastra,
                requestContext,
                memory,
                threadId: thread.id,
                effectiveResourceId,
              });
              if (!effectiveThreadId && history.history.length > 1) {
                throw createThreadBranchError(
                  'BRANCH_INVALID_REQUEST',
                  'Resource-scoped search requires threadId when shared-history branches exist.',
                );
              }
              accessibleThreadsForResource.push(thread);
            } catch (error) {
              if (error && typeof error === 'object' && (error as { id?: unknown }).id === 'BRANCH_NOT_FOUND') {
                continue;
              }
              throw error;
            }
          }
        } else {
          accessibleThreadsForResource = sanitizeLegacyThreadListOrThrow(authorizedThreads);
        }
        accessibleThreadIds = new Set(accessibleThreadsForResource.map(thread => thread.id));

        if (accessibleThreadsForResource.length === 0) {
          return {
            results: [],
            count: 0,
            query: searchQuery,
            searchScope: resourceScope ? 'resource' : 'thread',
            searchType: hasSemanticRecall ? 'semantic' : 'text',
          };
        }
      }

      // If threadId is provided, authorize its complete reachable ancestry.
      if (effectiveThreadId) {
        const branchState = await inspectVisibleMemoryThread(memory, effectiveThreadId, { allowCreate: true });
        const thread =
          branchState.state === 'absent' ? null : await memory.getThreadById({ threadId: effectiveThreadId });
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
        await authorizeMemoryThreadAccess({ mastra, requestContext, memory, thread, effectiveResourceId });
      }

      // Use effectiveThreadId or find one from the resource
      let searchThreadId = effectiveThreadId;

      // If no threadId provided, get one from the resource
      if (!searchThreadId) {
        const threads =
          accessibleThreadsForResource ??
          (
            await memory.listThreads({
              filter: { resourceId: effectiveResourceId },
              page: 0,
              perPage: 1,
              orderBy: { field: 'updatedAt', direction: 'DESC' },
            })
          ).threads;

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

      const threadConfig = memory.getMergedThreadConfig(config || {});
      const historyEnabled =
        threadConfig.lastMessages !== false && (threadConfig.lastMessages || threadConfig.messageHistory);
      if (!historyEnabled && !threadConfig.semanticRecall) {
        return { results: [], count: 0, query: searchQuery };
      }

      let accessibleMessages: MastraDBMessage[];
      if (resourceScope && accessibleThreadsForResource && shouldFilterThreadsWithFGA(mastra, requestContext)) {
        const perThreadConfig = {
          ...config,
          ...(config.semanticRecall
            ? {
                semanticRecall:
                  typeof config.semanticRecall === 'boolean'
                    ? { messageRange: 0, topK: 2, scope: 'thread' as const }
                    : { ...config.semanticRecall, messageRange: 0, scope: 'thread' as const },
              }
            : {}),
        };
        const results = await Promise.all(
          accessibleThreadsForResource.map(thread =>
            memory.recall({
              threadId: thread.id,
              threadConfig: perThreadConfig,
              vectorSearchString: threadConfig.semanticRecall && searchQuery ? searchQuery : undefined,
            }),
          ),
        );
        accessibleMessages = Array.from(
          new Map(results.flatMap(result => result.messages).map(message => [message.id, message])).values(),
        );
      } else {
        const result = await memory.recall({
          threadId: searchThreadId,
          resourceId: effectiveResourceId,
          threadConfig: config,
          vectorSearchString: threadConfig.semanticRecall && searchQuery ? searchQuery : undefined,
        });
        accessibleMessages = accessibleThreadIds
          ? result.messages.filter((message: MastraDBMessage) =>
              accessibleThreadIds!.has(message.threadId || searchThreadId!),
            )
          : result.messages;
      }

      if (accessibleMessages.length === 0) {
        return {
          results: [],
          count: 0,
          query: searchQuery,
          searchScope: resourceScope ? 'resource' : 'thread',
          searchType: hasSemanticRecall ? 'semantic' : 'text',
        };
      }

      // Get all threads to build context and show which thread each message is from
      // Fetch threads by IDs from the actual messages to avoid truncation
      const threadIds = Array.from(
        new Set(accessibleMessages.map((m: MastraDBMessage) => m.threadId || searchThreadId!).filter(Boolean)),
      );
      const fetched = await Promise.all(threadIds.map((id: string) => memory.getThreadById({ threadId: id })));
      const threadMap = new Map(fetched.filter(Boolean).map(t => [t!.id, t!]));

      // Process each message in the results
      for (const msg of accessibleMessages) {
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
