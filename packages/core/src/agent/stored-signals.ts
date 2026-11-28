import type { MastraMemory } from '../memory/memory';
import type { MastraDBMessage } from '../memory/types';
import { MASTRA_INHERITED_MEMORY_KEY } from '../request-context';
import type { RequestContext } from '../request-context';
import type { MemoryStorage } from '../storage/domains/memory/base';
import { mastraDBMessageToSignal } from './signals';
import type { CreatedAgentSignal } from './signals';

/**
 * Where the pending signals of a storage-backed run are kept: the memory
 * domain of the storage its memory uses, and the thread its rows belong to.
 */
export type ThreadSignalsStore = { store: MemoryStorage; threadId: string; resourceId: string };

type SignalQueueOwner = {
  id: string;
  __usesSharedRunLog?: () => boolean;
  hasOwnMemory?: () => boolean;
  getMemory: (options: { requestContext?: RequestContext }) => Promise<MastraMemory | undefined>;
};

/** The memory domain of `memory`'s storage, when it keeps pending signals. */
export async function pendingSignalsStoreOf(memory: MastraMemory | undefined): Promise<MemoryStorage | undefined> {
  if (!memory) return undefined;
  let storage: MastraMemory['storage'];
  try {
    storage = memory.storage;
  } catch {
    // A memory without storage keeps nothing.
    return undefined;
  }
  const store = await storage.getStore('memory');
  return store?.supportsPendingSignals ? store : undefined;
}

/**
 * Signals of stored rows. A row this release can't read is skipped: it is
 * neither consumed nor cancelled, so a release that can read it gets it.
 */
export function storedRowsToSignals(
  rows: MastraDBMessage[],
  onSkipped: (id: string, error: unknown) => void,
): CreatedAgentSignal[] {
  const signals: CreatedAgentSignal[] = [];
  for (const row of rows) {
    try {
      signals.push(mastraDBMessageToSignal(row));
    } catch (error) {
      onSkipped(row.id, error);
    }
  }
  return signals;
}

/**
 * Whether a run this agent starts on a thread may keep its signals in memory
 * storage, from what is known without resolving its memory: it runs on the
 * evented engine and has memory. Runs that fail this keep their signals in the
 * thread runtime's in-process queues.
 */
export function maySignalsBeStored(agent: unknown, requestContext?: RequestContext): boolean {
  const owner = agent as SignalQueueOwner | undefined;
  if (typeof owner?.__usesSharedRunLog !== 'function' || !owner.__usesSharedRunLog()) return false;
  if (owner.hasOwnMemory?.()) return true;
  const inherited = requestContext?.getRaw(MASTRA_INHERITED_MEMORY_KEY) as { agentId?: string } | undefined;
  return inherited?.agentId === owner.id;
}

/**
 * The store a run of `agent` on this thread keeps its signals in, or
 * `undefined` when they stay in the thread runtime's queues. Resolves the
 * agent's memory with the run's request context, as preparation does, so call
 * it only where that context is the run's.
 */
export async function resolveThreadSignalsStore(
  agent: unknown,
  target: { requestContext?: RequestContext; threadId?: string; resourceId?: string },
): Promise<ThreadSignalsStore | undefined> {
  const { requestContext, threadId, resourceId } = target;
  if (!threadId || !resourceId || !maySignalsBeStored(agent, requestContext)) return undefined;
  const memory = await (agent as SignalQueueOwner).getMemory({ requestContext });
  const store = await pendingSignalsStoreOf(memory);
  return store ? { store, threadId, resourceId } : undefined;
}
