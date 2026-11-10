import type { Agent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/di';
import type {
  MastraMemory,
  ObservationalMemoryInspector,
  ObservationalMemoryInspectorConfig,
} from '@mastra/core/memory';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { getGatewayClient, isGatewayAgentAsync, toLocalOMRecord } from './gateway-memory-client';

/**
 * Picks the inspector for an agent's Observational Memory: the memory class's own (OM runs
 * elsewhere, e.g. Platform Memory), then legacy gateway memory, then the agent's in-process
 * `observational-memory` processor. `null` when the agent has no OM.
 */
export async function resolveObservationalMemoryInspector({
  agent,
  memory,
  requestContext,
}: {
  agent: Agent | null;
  memory: MastraMemory | null | undefined;
  requestContext?: RequestContext;
}): Promise<ObservationalMemoryInspector | null> {
  const own = memory?.getObservationalMemoryInspector?.();
  if (own) return own;
  if (agent && (await isGatewayAgentAsync(agent))) {
    const gateway = gatewayInspector();
    if (gateway) return gateway;
  }
  if (agent && memory) return localInspector(agent, memory, requestContext);
  return null;
}

/**
 * The gateway record lacks the buffering watermark (Studio doesn't read it), may label a
 * generation `observation` (local OM calls it `initial`), and leaves some chunk fields optional.
 */
function toRecord(r: Parameters<typeof toLocalOMRecord>[0]): ObservationalMemoryRecord {
  const local = toLocalOMRecord(r);
  return {
    ...local,
    originType: local.originType === 'reflection' ? 'reflection' : 'initial',
    bufferedObservationChunks: local.bufferedObservationChunks?.map(chunk => ({
      ...chunk,
      id: chunk.id ?? chunk.cycleId,
      messageIds: chunk.messageIds ?? [],
      lastObservedAt: chunk.lastObservedAt ?? local.updatedAt,
      createdAt: chunk.createdAt ?? local.updatedAt,
    })),
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
  };
}

/** Legacy gateway-hosted memory. Its config isn't exposed, so these are `@mastra/memory`'s defaults. */
function gatewayInspector(): ObservationalMemoryInspector | null {
  const client = getGatewayClient();
  if (!client) return null;
  const getRecord: ObservationalMemoryInspector['getRecord'] = async ({
    threadId,
    resourceId,
    historyLimit,
    historyOptions,
  }) => {
    if (!threadId) return { record: null };
    const [current, history] = await Promise.all([
      client.getObservationRecord(threadId, resourceId),
      historyLimit
        ? client.getObservationHistory(threadId, { resourceId, limit: historyLimit, ...historyOptions })
        : undefined,
    ]);
    return {
      record: current.record ? toRecord(current.record) : null,
      history: history?.records?.length ? history.records.map(toRecord) : undefined,
    };
  };
  return {
    kind: 'gateway',
    getConfig: async () => ({ scope: 'thread', messageTokens: 30_000, observationTokens: 40_000 }),
    getRecord,
    // The gateway exposes no wait, so poll its record until the buffering flags clear (30s cap).
    waitForBuffering: async ({ threadId, resourceId }) => {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const { record } = await getRecord({ threadId, resourceId });
        if (!record || (!record.isBufferingObservation && !record.isBufferingReflection)) return;
        await new Promise(resolve => setTimeout(resolve, 1_000));
      }
    },
  };
}

type OMProcessor = {
  getResolvedConfig?: (requestContext?: RequestContext) => Promise<any>;
  config?: any;
  waitForBuffering?: (threadId: string | null | undefined, resourceId: string) => Promise<void>;
};

/** OM running in this process as the agent's `observational-memory` processor. */
async function localInspector(
  agent: Agent,
  memory: MastraMemory,
  requestContext?: RequestContext,
): Promise<ObservationalMemoryInspector | null> {
  // Guard against older @mastra/core versions that don't have resolveProcessorById
  if (typeof agent.resolveProcessorById !== 'function') return null;
  let processor: OMProcessor | undefined;
  try {
    processor = (await agent.resolveProcessorById('observational-memory', requestContext)) as OMProcessor | undefined;
  } catch {
    return null;
  }
  if (!processor) return null;
  const om = processor;

  const store = async () => {
    const memoryStore = await memory.storage.getStore('memory');
    if (!memoryStore) throw new Error('Memory storage is not initialized');
    return memoryStore;
  };

  return {
    kind: 'local',
    getConfig: async (): Promise<ObservationalMemoryInspectorConfig> => {
      if (typeof om.getResolvedConfig === 'function') {
        const c = await om.getResolvedConfig(requestContext);
        return {
          scope: c.scope || 'resource',
          shareTokenBudget: c.shareTokenBudget,
          messageTokens: c.observation?.messageTokens,
          observationTokens: c.reflection?.observationTokens,
          observationModel: c.observation?.model,
          reflectionModel: c.reflection?.model,
          observationModelRouting: c.observation?.routing,
          reflectionModelRouting: c.reflection?.routing,
        };
      }
      // Older processor versions only carry their raw config
      const c = om.config || {};
      return {
        scope: c.scope || 'resource',
        shareTokenBudget: c.shareTokenBudget,
        messageTokens: c.observation?.messageTokens,
        observationTokens: c.reflection?.observationTokens,
      };
    },
    getRecord: async ({ threadId, resourceId, historyLimit, historyOptions }) => {
      const memoryStore = await store();
      const record = await memoryStore.getObservationalMemory(threadId, resourceId);
      if (!historyLimit) return { record: record ?? null };
      const history = await memoryStore.getObservationalMemoryHistory(
        threadId,
        resourceId,
        historyLimit,
        historyOptions,
      );
      return { record: record ?? null, history: history.length > 0 ? history : undefined };
    },
    waitForBuffering: async ({ threadId, resourceId }) => {
      if (typeof om.waitForBuffering !== 'function') throw new Error('Observational Memory processor not available');
      await om.waitForBuffering(threadId, resourceId);
    },
  };
}
