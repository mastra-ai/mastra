import type { Mastra } from '@mastra/core/mastra';
import {
  getObservabilityStorageCapabilities,
  implementsObservabilityStorageMethod,
} from '../handlers/observability-shared';
import type { ObservabilityStorageCapabilities } from '../handlers/observability-shared';

/** What the server can serve, used by `mcp.requires` to hide tools whose backing route would fail. */
export interface BuiltinMCPCapabilities {
  /** A registered agent has memory, or stored agents (which can have memory) are available. */
  memory: boolean;
  /** The editor is configured and storage has the agents domain. */
  storedAgents: boolean;
  /** `null` when there is no observability store. */
  observability: ObservabilityStorageCapabilities | null;
  /** Scores have no feature declaration; these report whether the store implements the methods. */
  scores: { list: boolean; analyze: boolean };
  /** The store serves light traces (span records without input, output, or attributes). */
  traceStructure: boolean;
}

type StoreCapabilities = Pick<BuiltinMCPCapabilities, 'observability' | 'scores' | 'traceStructure'>;

const SCORE_ANALYSIS_METHODS = [
  'getScoreAggregate',
  'getScoreBreakdown',
  'getScoreTimeSeries',
  'getScorePercentiles',
] as const;

const storeCapabilities = new WeakMap<Mastra, Promise<StoreCapabilities | undefined>>();

const NO_STORE: StoreCapabilities = {
  observability: null,
  scores: { list: false, analyze: false },
  traceStructure: false,
};

/** `undefined` when the store lookup failed, so the next call tries again. */
async function resolveStoreCapabilities(mastra: Mastra): Promise<StoreCapabilities | undefined> {
  let store;
  try {
    store = await mastra.getStorage()?.getStore('observability');
  } catch {
    return undefined;
  }
  if (!store) return NO_STORE;
  return {
    observability: getObservabilityStorageCapabilities(store),
    scores: {
      list: implementsObservabilityStorageMethod(store, 'listScores'),
      analyze: SCORE_ANALYSIS_METHODS.every(method => implementsObservabilityStorageMethod(store, method)),
    },
    // Stores override either name; the base class forwards one to the other.
    traceStructure:
      implementsObservabilityStorageMethod(store, 'getTraceLight') ||
      implementsObservabilityStorageMethod(store, 'getStructure'),
  };
}

/**
 * Store capabilities are resolved once per Mastra instance (the store does not change while the process runs),
 * unless the lookup fails, which is retried on the next call; memory and the editor are checked on every call
 * because agents can be added at runtime.
 */
export async function getBuiltinMCPCapabilities(mastra: Mastra): Promise<BuiltinMCPCapabilities> {
  let pending = storeCapabilities.get(mastra);
  if (!pending) {
    pending = resolveStoreCapabilities(mastra);
    storeCapabilities.set(mastra, pending);
  }
  const storage = mastra.getStorage();
  const storedAgents =
    Boolean(mastra.getEditor?.()) && Boolean(await storage?.getStore('agents').catch(() => undefined));
  const agentMemory = Object.values(mastra.listAgents?.() ?? {}).some(agent => agent.hasOwnMemory?.());
  const store = await pending;
  if (!store) storeCapabilities.delete(mastra);
  return { ...(store ?? NO_STORE), storedAgents, memory: agentMemory || storedAgents };
}
