import { TTLCache } from '@isaacs/ttlcache';
import type { MastraScorer } from '../../evals/base';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import { executionFailureTermination } from '../../loop/shared/execution-outcome';
import { TOOL_ABORT_GRACE_MS, TOOL_SETTLE_MARGIN_MS } from '../../loop/shared/tool-abort-grace';
import { settledOrElapsed } from '../../loop/timeout';
import type { Mastra } from '../../mastra';
import { unwrapMastraTracingProxy } from '../../observability/context';
import type { CoreTool } from '../../tools/types';
import type { MessageList } from '../message-list';
import type { SaveQueueManager } from '../save-queue';
import { stopDurableExecutionParticipants } from './evented-execution';
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

/**
 * Read a run's registry entry as seen from a workflow step running under `mastra`.
 *
 * Entries are keyed only by runId, so when another Mastra instance in this
 * process reuses the runId, a still-running workflow from the earlier run
 * would otherwise read (and write its transcript into) the new run's entry.
 * An entry owned by a different Mastra instance is treated as absent. An
 * ownerless entry (a placeholder or rehydrated entry) is claimed by the first
 * scoped reader, so a later instance reusing the runId cannot adopt it.
 */
export function getRunRegistryEntry(runId: string, mastra: Mastra | undefined): RunRegistryEntry | undefined {
  const entry = globalRunRegistry.has(runId) ? globalRunRegistry.get(runId) : undefined;
  if (!entry || !mastra) return entry;
  if (!entry.mastra) {
    entry.mastra = mastra;
    return entry;
  }
  return unwrapMastraTracingProxy(entry.mastra) === unwrapMastraTracingProxy(mastra) ? entry : undefined;
}

/**
 * Publish an entry for `runId`, owned by `mastra`, unless the slot holds
 * another Mastra instance's live run. Returns whether the entry was stored.
 */
export function setRunRegistryEntry(runId: string, entry: RunRegistryEntry, mastra: Mastra | undefined): boolean {
  const current = globalRunRegistry.has(runId) ? globalRunRegistry.get(runId) : undefined;
  if (current?.mastra && mastra && unwrapMastraTracingProxy(current.mastra) !== unwrapMastraTracingProxy(mastra))
    return false;
  if (mastra) entry.mastra ??= mastra;
  globalRunRegistry.set(runId, entry);
  return true;
}

/** Remove `runId`'s entry only if it belongs to `mastra` (or has no owner). */
export function deleteRunRegistryEntry(runId: string, mastra: Mastra | undefined): void {
  if (getRunRegistryEntry(runId, mastra)) globalRunRegistry.delete(runId);
}

/**
 * Scorer instances a run was configured with, keyed like the serialized
 * `scorers` workflow input. Workflow input only carries scorer names, so a
 * scorer passed at call time or via `defaultOptions.scorers` that is not
 * registered on Mastra can only run in-process through this store (#27579).
 *
 * Kept apart from the run registry entry: callers typically `cleanup()` as
 * soon as the output resolves, which drops that entry before the trailing
 * scorer step runs. Entries are consumed by the scorer step; the TTL only
 * bounds runs that never reach it.
 */
const runScorerInstances = new TTLCache<string, { mastra?: Mastra; scorers: Record<string, MastraScorer> }>({
  max: 1000,
  ttl: RUN_REGISTRY_TTL_MS,
});

export function setRunScorerInstances(
  runId: string,
  scorers: Record<string, MastraScorer>,
  mastra: Mastra | undefined,
): void {
  if (Object.keys(scorers).length === 0) return;
  runScorerInstances.set(runId, { mastra, scorers });
}

/** Remove and return the run's scorer instances, unless another Mastra owns them. */
export function takeRunScorerInstances(
  runId: string,
  mastra: Mastra | undefined,
): Record<string, MastraScorer> | undefined {
  const entry = runScorerInstances.get(runId);
  if (!entry) return undefined;
  if (entry.mastra && mastra && unwrapMastraTracingProxy(entry.mastra) !== unwrapMastraTracingProxy(mastra)) {
    return undefined;
  }
  runScorerInstances.delete(runId);
  return entry.scorers;
}

/** runId -> number of in-flight operations holding the entry alive. */
const activeRuns = new Map<string, number>();
let activityHeartbeat: ReturnType<typeof setInterval> | undefined;

function runActivityHeartbeat(): void {
  // The read is the point: `updateAgeOnGet` refreshes the sliding TTL.
  for (const runId of activeRuns.keys()) {
    globalRunRegistry.get(runId);
  }
}

const inFlightResumes = new Map<string, Map<string, symbol>>();

/**
 * Marks a resume of `toolCallId` on `runId` as in flight in this process,
 * synchronously, so a concurrent resume of the same tool call can fail fast
 * instead of queueing on the execution claim (#27365).
 *
 * @returns A release function, or `undefined` when that tool call already has
 * a resume in flight. Release is idempotent and only clears its own marker.
 */
export function markResumeInFlight(runId: string, toolCallId: string): (() => void) | undefined {
  let byToolCall = inFlightResumes.get(runId);
  if (byToolCall?.has(toolCallId)) return undefined;
  if (!byToolCall) inFlightResumes.set(runId, (byToolCall = new Map()));
  const token = Symbol(toolCallId);
  byToolCall.set(toolCallId, token);
  return () => {
    const current = inFlightResumes.get(runId);
    if (current?.get(toolCallId) !== token) return;
    current.delete(toolCallId);
    if (current.size === 0) inFlightResumes.delete(runId);
  };
}

/**
 * Clears the in-flight marker for a tool call whose resumed segment is
 * suspending again, so a later resume of it is not treated as a duplicate.
 */
export function clearResumeInFlight(runId: string, toolCallId: string): void {
  const current = inFlightResumes.get(runId);
  if (!current) return;
  current.delete(toolCallId);
  if (current.size === 0) inFlightResumes.delete(runId);
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

// `values()` can yield undefined: with `updateAgeOnGet`, `get()` on a missing
// runId schedules an expiration for a key that has no value.
function registryEntries(): RunRegistryEntry[] {
  return Array.from(globalRunRegistry.values()).filter(entry => entry !== undefined);
}

export function getActiveDurableAgentWorkflowExecutions(mastra: Mastra): Promise<unknown>[] {
  return registryEntries().flatMap(entry =>
    entry.mastra === mastra && entry.workflowExecution ? [entry.workflowExecution] : [],
  );
}

/**
 * Whether shutdown only detaches `mastra` from this durable-agent execution rather than abandoning it: an evented
 * execution behind a broker, which another process may be executing.
 */
function detachesOnShutdown(mastra: Mastra, entry: RunRegistryEntry): boolean {
  return !!entry.eventedExecution && !(mastra.pubsub.__rawBus() instanceof EventEmitterPubSub);
}

export function isDurableAgentExecutionDetached(mastra: Mastra, runId: string): boolean {
  const entry = globalRunRegistry.has(runId) ? globalRunRegistry.get(runId) : undefined;
  return !!entry && entry.mastra === mastra && detachesOnShutdown(mastra, entry);
}

/** The tool calls each run's execution is running now, keyed by its registry entry. */
const toolCallsInFlight = new WeakMap<RunRegistryEntry, number>();
/** Runs with a tool call whose result is not checkpointed yet: set when the call starts, cleared at the next model request. */
const toolResultsPending = new WeakSet<RunRegistryEntry>();

/** Marks a tool call of this run as running. Call the returned function once its body has settled. */
export function startToolCall(entry: RunRegistryEntry | undefined): () => void {
  if (!entry) return () => {};
  toolResultsPending.add(entry);
  toolCallsInFlight.set(entry, (toolCallsInFlight.get(entry) ?? 0) + 1);
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    const count = (toolCallsInFlight.get(entry) ?? 1) - 1;
    if (count > 0) toolCallsInFlight.set(entry, count);
    else toolCallsInFlight.delete(entry);
  };
}

/**
 * Called by the durable steps before a model request or a tool call starts. A run that shutdown asked to stop once
 * its tool calls finished stops here. Before a model request its earlier tool results were checkpointed by the steps
 * before this one; a tool call that has not started yet is left for recovery to run.
 */
export async function stopAtShutdownBoundary(
  entry: RunRegistryEntry | undefined,
  ownership: { composeSignal(signal: AbortSignal | undefined): AbortSignal; throwIfLost(): void } | undefined,
  before: 'model-request' | 'tool-call',
): Promise<void> {
  if (entry && before === 'model-request') toolResultsPending.delete(entry);
  const reached = entry?.shutdownBoundary;
  if (!reached || !ownership) return;
  const lost = ownership.composeSignal(undefined);
  const stopped = new Promise<void>(resolve => {
    if (lost.aborted) resolve();
    else lost.addEventListener('abort', () => resolve(), { once: true });
  });
  reached();
  await stopped;
  ownership.throwIfLost();
}

/**
 * How long shutdown keeps an execution's claim, past its drain deadline, for tool calls still running. A tool that
 * finishes in time has its result checkpointed and is not run again on recovery.
 */
export const SHUTDOWN_TOOL_SETTLE_MS = TOOL_ABORT_GRACE_MS + TOOL_SETTLE_MARGIN_MS;

/**
 * Abandon the durable-agent executions `mastra` is still running: each stops
 * without writing and releases its run, so recovery can take it right away.
 * Executions that already settled are left alone.
 *
 * An execution with a tool result not checkpointed yet is first given up to `toolSettleMs` to finish its tool calls
 * and reach its next model request, so the results are checkpointed rather than discarded and the tools run again on
 * recovery. It starts no further tool calls meanwhile. One whose tool call is still running after that keeps its
 * claim until the claim expires, so recovery can't run the tool a second time while this process may still be
 * running it.
 */
export async function abandonDurableAgentExecutions(
  mastra: Mastra,
  { toolSettleMs = SHUTDOWN_TOOL_SETTLE_MS }: { toolSettleMs?: number } = {},
): Promise<void> {
  await stopDurableExecutionParticipants(mastra);
  await Promise.allSettled(
    registryEntries().map(async entry => {
      const fence = entry.executionFence;
      if (entry.mastra !== mastra || !fence) return;
      // A broker does not prove that this is the only executing process.
      if (detachesOnShutdown(mastra, entry)) return fence.detach();
      if (toolResultsPending.has(entry)) {
        const boundary = new Promise<void>(resolve => (entry.shutdownBoundary = resolve));
        await settledOrElapsed(
          Promise.race([boundary, fence.whenSettled, ...(entry.workflowExecution ? [entry.workflowExecution] : [])]),
          toolSettleMs,
        );
      }
      await fence.abandon({ release: !toolCallsInFlight.has(entry) });
    }),
  );
}

/**
 * End a run's root spans (MODEL_GENERATION then AGENT_RUN) with an error so the trace
 * still exports — stores persist only span-end events. After a resume the fresh resume
 * spans are the active root, so prefer them. Ending an already-ended span is a no-op,
 * so the duplicate error paths (workflow failure + emitError) are safe. Never throws.
 */
export function endRunSpansWithError(runId: string, error: Error, options: { endSpan?: boolean } = {}): void {
  try {
    const entry = globalRunRegistry.has(runId) ? globalRunRegistry.get(runId) : undefined;
    (entry?.resumeModelSpan ?? entry?.modelSpan)?.error({
      error,
      ...executionFailureTermination(error),
      endSpan: options.endSpan ?? true,
    });
    (entry?.resumeAgentSpan ?? entry?.agentSpan)?.error({
      error,
      ...executionFailureTermination(error),
      endSpan: options.endSpan ?? true,
    });
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
