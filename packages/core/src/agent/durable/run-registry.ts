import { TTLCache } from '@isaacs/ttlcache';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { Mastra } from '../../mastra';
import type { CoreTool } from '../../tools/types';
import type { MessageList } from '../message-list';
import type { SaveQueueManager } from '../save-queue';
import type { RunRegistryEntry } from './types';

/**
 * Global registry for accessing run entries from workflow steps.
 * This is necessary because workflow steps don't have direct access to
 * the DurableAgent instance's registry.
 *
 * Entries are keyed by runId (which are unique UUIDs).
 *
 * Uses TTLCache to prevent unbounded memory growth: entries auto-expire
 * (refreshed on access) and the registry is hard-capped at 1000 concurrent
 * entries.
 *
 * The TTL is a crash/leak safety net, NOT an activity timeout. A run that is
 * actively executing — waiting on a tool, a sub-agent, or a model call — can
 * go arbitrarily long without anything reading its entry, and disposal is
 * destructive (it force-closes the run's stream and drops the live model and
 * tools). Such runs hold their entry alive explicitly via `markRunActive`.
 */
export const RUN_REGISTRY_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * How often active runs re-read their registry entry to refresh the sliding
 * TTL. Two orders of magnitude below the TTL, so a single missed tick is
 * harmless.
 */
export const RUN_REGISTRY_HEARTBEAT_MS = 60 * 1000;

export const globalRunRegistry = new TTLCache<string, RunRegistryEntry>({
  max: 1000,
  ttl: RUN_REGISTRY_TTL_MS,
  updateAgeOnGet: true,
  dispose: entry => {
    entry?.cleanup?.();
  },
  noDisposeOnSet: true,
});

/** runId -> number of in-flight operations holding the entry alive. */
const activeRuns = new Map<string, number>();
let activityHeartbeat: ReturnType<typeof setInterval> | undefined;

function runActivityHeartbeat(): void {
  // The read is the point: `updateAgeOnGet` refreshes the sliding TTL.
  for (const runId of activeRuns.keys()) {
    globalRunRegistry.get(runId);
  }
}

/**
 * Hold a run's registry entry alive while an operation is in flight.
 *
 * Durable steps await work that can outlast the registry TTL (a tool or
 * sub-agent call, a stalled model call). Nothing reads the entry while that
 * await is pending, so the sliding TTL would otherwise expire it mid-run and
 * dispose the live runtime state out from under the still-running workflow.
 *
 * Refcounted, so concurrent operations on the same run each hold their own
 * claim. The returned release is idempotent — calling it twice releases one
 * claim, not two. Always release in a `finally`; if a release is ever missed
 * the entry still expires once the heartbeat stops, so this degrades safely.
 *
 * @param runId - The unique run identifier
 * @returns A function that releases this claim
 */
export function markRunActive(runId: string): () => void {
  activeRuns.set(runId, (activeRuns.get(runId) ?? 0) + 1);

  if (!activityHeartbeat) {
    activityHeartbeat = setInterval(runActivityHeartbeat, RUN_REGISTRY_HEARTBEAT_MS);
    // Never keep the process alive just to refresh a cache.
    activityHeartbeat.unref?.();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const remaining = (activeRuns.get(runId) ?? 1) - 1;
    if (remaining > 0) {
      activeRuns.set(runId, remaining);
    } else {
      activeRuns.delete(runId);
    }

    if (activeRuns.size === 0 && activityHeartbeat) {
      clearInterval(activityHeartbeat);
      activityHeartbeat = undefined;
    }
  };
}

/**
 * Drop all activity claims and stop the heartbeat. Tests only — production
 * code releases claims through the function returned by `markRunActive`.
 */
export function __resetRunRegistryActivityForTests(): void {
  activeRuns.clear();
  if (activityHeartbeat) {
    clearInterval(activityHeartbeat);
    activityHeartbeat = undefined;
  }
}

export function getActiveDurableAgentWorkflowExecutions(mastra: Mastra): Promise<unknown>[] {
  return Array.from(globalRunRegistry.values()).flatMap(entry =>
    entry.mastra === mastra && entry.workflowExecution ? [entry.workflowExecution] : [],
  );
}

/**
 * End a run's root spans (MODEL_GENERATION then AGENT_RUN) with an error so the trace
 * still exports — stores persist only span-end events. After a resume the fresh resume
 * spans are the active root, so prefer them. Ending an already-ended span is a no-op,
 * so the duplicate error paths (workflow failure + emitError) are safe. Never throws.
 */
export function endRunSpansWithError(runId: string, error: Error): void {
  try {
    const entry = globalRunRegistry.get(runId);
    (entry?.resumeModelSpan ?? entry?.modelSpan)?.error({ error, endSpan: true });
    (entry?.resumeAgentSpan ?? entry?.agentSpan)?.error({ error, endSpan: true });
  } catch {
    // Span bookkeeping must never break error reporting.
  }
}

/**
 * Registry for per-run non-serializable state.
 *
 * During durable execution, the DurableAgent needs to store non-serializable
 * objects (tools with execute functions, SaveQueueManager, etc.) that can't
 * flow through workflow state. This registry provides a way to store and
 * retrieve these objects keyed by runId.
 *
 * The registry is scoped to a single DurableAgent instance and entries are
 * cleaned up when a run completes.
 */
export class RunRegistry {
  #entries = new Map<string, RunRegistryEntry>();

  /**
   * Register non-serializable state for a run
   * @param runId - The unique run identifier
   * @param entry - The registry entry containing tools, saveQueueManager, etc.
   */
  register(runId: string, entry: RunRegistryEntry): void {
    // Clean up any existing entry first
    this.cleanup(runId);
    this.#entries.set(runId, entry);
  }

  /**
   * Get the registry entry for a run
   * @param runId - The unique run identifier
   * @returns The registry entry or undefined if not found
   */
  get(runId: string): RunRegistryEntry | undefined {
    return this.#entries.get(runId);
  }

  /**
   * Get tools for a specific run
   * @param runId - The unique run identifier
   * @returns The tools record or an empty object if not found
   */
  getTools(runId: string): Record<string, CoreTool> {
    return this.#entries.get(runId)?.tools ?? {};
  }

  /**
   * Get SaveQueueManager for a specific run
   * @param runId - The unique run identifier
   * @returns The SaveQueueManager or undefined if not found
   */
  getSaveQueueManager(runId: string): SaveQueueManager | undefined {
    return this.#entries.get(runId)?.saveQueueManager;
  }

  /**
   * Get the language model for a specific run
   * @param runId - The unique run identifier
   * @returns The MastraLanguageModel or undefined if not found
   */
  getModel(runId: string): MastraLanguageModel | undefined {
    return this.#entries.get(runId)?.model;
  }

  /**
   * Check if a run is registered
   * @param runId - The unique run identifier
   * @returns True if the run is registered
   */
  has(runId: string): boolean {
    return this.#entries.has(runId);
  }

  /**
   * Cleanup and remove a run's entry from the registry
   * @param runId - The unique run identifier
   */
  cleanup(runId: string): void {
    const entry = this.#entries.get(runId);
    if (entry) {
      // Call cleanup function if provided
      entry.cleanup?.();
      this.#entries.delete(runId);
    }
  }

  /**
   * Get the number of active runs in the registry
   */
  get size(): number {
    return this.#entries.size;
  }

  /**
   * Get all active run IDs
   */
  get runIds(): string[] {
    return Array.from(this.#entries.keys());
  }

  /**
   * Clear all entries from the registry
   * Calls cleanup on each entry before removing
   */
  clear(): void {
    for (const runId of this.#entries.keys()) {
      this.cleanup(runId);
    }
  }
}

/**
 * Extended registry entry that also stores the MessageList reference.
 * This is useful for accessing message state outside of workflow steps
 * (e.g., for callbacks that need to read messages).
 */
export interface ExtendedRunRegistryEntry extends RunRegistryEntry {
  /** MessageList reference for callback access */
  messageList?: MessageList;
  /** Thread ID for memory */
  threadId?: string;
  /** Resource ID for memory */
  resourceId?: string;
}

/**
 * Extended run registry that also stores MessageList references and memory info
 */
export class ExtendedRunRegistry extends RunRegistry {
  #messageLists = new Map<string, MessageList>();
  #memoryInfo = new Map<string, { threadId?: string; resourceId?: string }>();

  /**
   * Register non-serializable state for a run including MessageList
   */
  registerWithMessageList(
    runId: string,
    entry: RunRegistryEntry,
    messageList: MessageList,
    memoryInfo?: { threadId?: string; resourceId?: string },
  ): void {
    this.register(runId, entry);
    this.#messageLists.set(runId, messageList);
    if (memoryInfo) {
      this.#memoryInfo.set(runId, memoryInfo);
    }
  }

  /**
   * Get MessageList for a specific run
   */
  getMessageList(runId: string): MessageList | undefined {
    return this.#messageLists.get(runId);
  }

  /**
   * Get memory info for a specific run
   */
  getMemoryInfo(runId: string): { threadId?: string; resourceId?: string } | undefined {
    return this.#memoryInfo.get(runId);
  }

  /**
   * Override cleanup to also remove MessageList and memory info
   */
  override cleanup(runId: string): void {
    super.cleanup(runId);
    this.#messageLists.delete(runId);
    this.#memoryInfo.delete(runId);
  }

  /**
   * Override clear to also clear MessageLists and memory info
   */
  override clear(): void {
    super.clear();
    this.#messageLists.clear();
    this.#memoryInfo.clear();
  }
}
