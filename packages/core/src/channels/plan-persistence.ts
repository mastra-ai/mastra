import type { Agent } from '../agent';

/**
 * A single task within a persisted channel plan.
 *
 * Mirrors what the channel sent to the live Chat SDK `Plan` instance, so we
 * can re-render the plan after a server restart by replaying tasks via
 * `Plan.addTask` / `Plan.updateTask`.
 */
export interface PersistedPlanTask {
  /** Stable identifier exposed to the LLM. Used to target task_update / task_complete. */
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  /** Optional free-form details rendered under the task title. */
  details?: string;
  /**
   * Lines accumulated from non-plan tool calls folded under this task in
   * `toolDisplay: 'inline'` mode. The channel renders these as the task's
   * `output` field on the Plan widget.
   */
  toolOutputs?: string[];
}

/**
 * A channel plan persisted to Mastra thread metadata under
 * `metadata.channelPlan`. Source of truth for plan tools and
 * `consumeAgentStream`; the in-memory `Plan` instance is just a cache /
 * platform handle.
 */
export interface PersistedPlan {
  /** Unique id; a new one is minted each time a fresh plan is opened. */
  planId: string;
  status: 'active' | 'completed';
  createdAt: number;
  completedAt?: number;
  /**
   * Platform message id where the live Plan widget was first posted. Stored
   * for diagnostics — re-attaching to an existing Plan widget after a server
   * restart is not currently supported by the Chat SDK, so on rehydration we
   * post a new widget.
   */
  planMessageId?: string;
  initialMessage: string;
  completeMessage: string;
  toolDisplay: 'inline' | 'hidden';
  tasks: PersistedPlanTask[];
}

const METADATA_KEY = 'channelPlan';

/**
 * Read the persisted channel plan from a Mastra thread's metadata.
 *
 * Returns `null` when no plan is stored or storage is unavailable.
 */
export async function loadPersistedPlan(
  agent: Agent<any, any, any, any>,
  mastraThreadId: string,
): Promise<PersistedPlan | null> {
  const memoryStore = await getMemoryStore(agent);
  if (!memoryStore) return null;
  const thread = await memoryStore.getThreadById({ threadId: mastraThreadId });
  if (!thread) return null;
  const plan = (thread.metadata as Record<string, unknown> | undefined)?.[METADATA_KEY];
  if (!plan || typeof plan !== 'object') return null;
  return plan as PersistedPlan;
}

/**
 * Upsert the channel plan into a Mastra thread's metadata. Merges with the
 * existing metadata object so other keys (e.g. `pendingToolApprovals`,
 * `channel_subscribed`) are preserved.
 */
export async function savePersistedPlan(
  agent: Agent<any, any, any, any>,
  mastraThreadId: string,
  plan: PersistedPlan,
): Promise<void> {
  const memoryStore = await getMemoryStore(agent);
  if (!memoryStore) return;
  const thread = await memoryStore.getThreadById({ threadId: mastraThreadId });
  if (!thread) return;
  const metadata = { ...(thread.metadata ?? {}), [METADATA_KEY]: plan };
  await memoryStore.saveThread({
    thread: {
      ...thread,
      metadata,
      updatedAt: new Date(),
    },
  });
}

/**
 * Remove the persisted plan from a thread's metadata. Used when the LLM
 * explicitly completes the plan or when the channel finalizes it on
 * `error` / `abort`.
 */
export async function clearPersistedPlan(agent: Agent<any, any, any, any>, mastraThreadId: string): Promise<void> {
  const memoryStore = await getMemoryStore(agent);
  if (!memoryStore) return;
  const thread = await memoryStore.getThreadById({ threadId: mastraThreadId });
  if (!thread) return;
  const existing = thread.metadata ?? {};
  if (!(METADATA_KEY in existing)) return;
  const next = { ...existing };
  delete (next as Record<string, unknown>)[METADATA_KEY];
  await memoryStore.saveThread({
    thread: {
      ...thread,
      metadata: next,
      updatedAt: new Date(),
    },
  });
}

async function getMemoryStore(agent: Agent<any, any, any, any>) {
  try {
    const memory = await agent.getMemory();
    return memory ?? null;
  } catch {
    return null;
  }
}
