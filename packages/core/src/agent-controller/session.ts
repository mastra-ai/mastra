import type { Agent } from '../agent';
import type { MastraDBMessage, MastraProviderMetadata } from '../agent/message-list/state/types';
import { createSignal, resolveDeliveryAttributes } from '../agent/signals';
import type {
  AgentSignalAttributes,
  AgentSignalContents,
  AgentSignalInput,
  CreatedAgentSignal,
} from '../agent/signals';
import type {
  AgentSignalActiveBehavior,
  AgentSignalIdleBehavior,
  AgentThreadSubscription,
  MastraBrowser,
  SendAgentNotificationSignalOptions,
  SendAgentNotificationSignalResult,
  SendAgentSignalAccepted,
  ToolsetsInput,
} from '../agent/types';
import { getErrorFromUnknown } from '../error';
import type { MastraModelGatewayInterface } from '../llm/model/gateways';
import { ModelRouterLanguageModel } from '../llm/model/router';
import type { MastraModelConfig } from '../llm/model/shared.types';
import { createRunScopeKey } from '../mastra/run-scope';
import type { RunScope } from '../mastra/run-scope';
import { TITLE_PINNED_THREAD_METADATA_KEY } from '../memory';
import type { MastraMemory } from '../memory/memory';
import type { SendNotificationSignalInput } from '../notifications';
import type { TracingContext, TracingOptions } from '../observability';
import { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { StorageListMessagesOutput } from '../storage/types';
import type { SubmitPlanResumeData } from '../tools/builtin/submit-plan';
import { safeStringify } from '../utils';
import { Workspace } from '../workspace';

import { SessionStartupCancelledError } from './errors';
import { readMessageAuthor, withMessageAuthor } from './message-author';
import { SessionRunEngine } from './session-run-engine';
import type { TaskItemSnapshot } from './tools';
import { createEmptyTokenUsage, defaultDisplayState, defaultOMProgressState } from './types';
import type {
  AgentControllerDisplayState,
  AgentControllerEvent,
  AgentControllerEventListener,
  AgentControllerMode,
  AgentControllerOMConfig,
  AgentControllerRequestContext,
  AgentControllerRequestState,
  AgentControllerRequestStateUpdater,
  AgentControllerThinkingLevel,
  AgentControllerThread,
  ModelUseCountTracker,
  OMModel,
  PermissionPolicy,
  PermissionRules,
  TokenUsage,
  ToolCategory,
} from './types';

export const SUSPENDED_RUN_AGENT_KEY = createRunScopeKey<Agent>('agent-controller.suspendedRunAgent');
export const SOURCE_APPROVAL_CALLS_KEY = createRunScopeKey<Set<string>>('agent-controller.sourceApprovalCalls');

/**
 * Bucket key for grants that apply to every thread. Grant calls that name no
 * thread (an embedder granting up front) land here; grants made from an
 * approval prompt are filed under the thread that owns the gate instead.
 */
const SESSION_WIDE_GRANT_BUCKET = '\u0000session-wide';

/**
 * Memory the suspended run persisted its messages under, resolved with the
 * run's own RequestContext while the stream was live. Abort settlement cannot
 * rebuild that context later (dynamic `memory: ({ requestContext }) => …`
 * configs would resolve differently against an empty context), so the resolved
 * instance is retained beside the owning agent for the life of the run scope.
 */
export const SUSPENDED_RUN_MEMORY_KEY = createRunScopeKey<MastraMemory>('agent-controller.suspendedRunMemory');

/**
 * Minimal persistence surface the Session uses to read and write per-thread
 * settings (mode id, per-mode model id, …). The AgentController backs this with thread
 * metadata; when no storage is configured it is absent and the Session keeps
 * its state purely in memory.
 */
export interface ThreadSettingsStore {
  /** Read all settings for a specific thread. */
  getAllOn(threadId: string): Promise<Record<string, unknown>>;
  /** Read a setting for the active thread, or undefined when unset/unavailable. */
  get(key: string): Promise<unknown>;
  /** Return the active thread id, or undefined when no thread is bound. */
  getThreadId(): string | undefined;
  /** Persist a setting for the active thread (no-op when storage is unavailable). */
  set(key: string, value: unknown): Promise<void>;
  /** Persist a setting to a specific thread. */
  setOn(threadId: string, key: string, value: unknown): Promise<void>;
  /** Persist a model selection and its preferences in one metadata write. */
  setModelOn(threadId: string, settings: Record<string, unknown>): Promise<void>;
}

/** Process-local listener awaited before a terminal agent event is emitted. */
export type SessionBeforeAgentEndListener = (
  event: Extract<AgentControllerEvent, { type: 'agent_end' }>,
) => void | Promise<void>;

/** Options for {@link Session.sendNotificationSignal}. */
export type SessionSendNotificationSignalOptions = {
  ifActive?: SendAgentNotificationSignalOptions['ifActive'];
  ifIdle?: SendAgentNotificationSignalOptions['ifIdle'];
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
  requestContext?: RequestContext;
};

/** Usage fields that are summed across steps when present on a step's usage. */
type OptionalUsageField =
  | 'reasoningTokens'
  | 'cachedInputTokens'
  | 'cacheCreationInputTokens'
  | 'cacheCreationInputTokens5m'
  | 'cacheCreationInputTokens1h';

function addOptionalUsageField(usage: TokenUsage, key: OptionalUsageField, value: number | undefined): void {
  if (value !== undefined) {
    usage[key] = (usage[key] ?? 0) + value;
  }
}

/** Persisted thread-setting key for the currently-selected mode. */
const MODE_ID_KEY = 'currentModeId';

/**
 * Reason attached to tool prompts retracted because the user aborted the run.
 * Shared by the parked-suspension retraction and the gated-approval decline so
 * both render the same "the user interrupted this" explanation.
 */
export const ABORTED_BY_USER_REASON = 'Aborted by the user';

/**
 * Session-state keys that are transparently persisted to thread metadata on
 * every state update and restored by `Session.loadMetadata()`. These are user
 * preferences that must survive a host restart (sessions themselves are
 * in-memory only).
 */
const PERSISTED_STATE_KEYS = ['thinkingLevel', 'notifications'] as const;
const OM_STATE_KEYS = ['observerModelId', 'reflectorModelId', 'observationThreshold', 'reflectionThreshold'] as const;
const THREAD_DERIVED_STATE_KEYS = [...OM_STATE_KEYS, ...PERSISTED_STATE_KEYS] as const;
function isSubagentModelKey(key: string): boolean {
  return key === 'subagentModelId' || key.startsWith('subagentModelId_');
}

function threadDerivedStateKeys(state: Record<string, unknown>): string[] {
  return [...THREAD_DERIVED_STATE_KEYS, ...Object.keys(state).filter(isSubagentModelKey)];
}

/** Version marker for thread metadata using the single-model persistence format. */
export const MODEL_PERSISTENCE_VERSION = 2 as const;
export const MODEL_PERSISTENCE_VERSION_KEY = 'modelPersistenceVersion' as const;

const modelPersistenceQueues = new Map<string, Promise<void>>();

async function runModelPersistenceOperation<T>(threadId: string | undefined, operation: () => Promise<T>): Promise<T> {
  if (!threadId) return operation();

  const previous = modelPersistenceQueues.get(threadId) ?? Promise.resolve();
  const result = previous.catch(() => {}).then(operation);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  modelPersistenceQueues.set(threadId, settled);

  try {
    return await result;
  } finally {
    if (modelPersistenceQueues.get(threadId) === settled) modelPersistenceQueues.delete(threadId);
  }
}

/**
 * Resolve and migrate a thread's persisted model selection.
 *
 * Threads created before single-model sessions have a create-time `currentModelId`
 * plus the actual last selection in `modeModelId_<mode>`. Without the version
 * marker, the active mode's legacy value wins. Migration copies that selection
 * to `currentModelId`, stamps the marker, then removes all obsolete mode keys.
 */
export async function migratePersistedModelSelection({
  metadata,
  getMetadata,
  modeId,
  onResolved,
  set,
  threadId,
  validModeIds,
}: {
  metadata?: Record<string, unknown>;
  getMetadata?: () => Promise<Record<string, unknown>>;
  modeId: string;
  onResolved?: (modelId: string, metadata: Record<string, unknown>) => void | Promise<void>;
  set: (key: string, value: unknown) => Promise<void>;
  threadId?: string;
  validModeIds?: readonly string[];
}): Promise<string | undefined> {
  return runModelPersistenceOperation(threadId, async () => {
    const persistedMetadata = getMetadata ? await getMetadata() : (metadata ?? {});
    const currentModelId =
      typeof persistedMetadata.currentModelId === 'string' ? persistedMetadata.currentModelId : undefined;
    const persistedModeId = persistedMetadata.currentModeId;
    const migrationModeId =
      typeof persistedModeId === 'string' && (!validModeIds || validModeIds.includes(persistedModeId))
        ? persistedModeId
        : modeId;
    const legacyKey = `modeModelId_${migrationModeId}`;
    const legacyModelId = typeof persistedMetadata[legacyKey] === 'string' ? persistedMetadata[legacyKey] : undefined;
    const legacyKeys = Object.keys(persistedMetadata).filter(
      key => key.startsWith('modeModelId_') && persistedMetadata[key] !== undefined,
    );
    const persistenceVersion = persistedMetadata[MODEL_PERSISTENCE_VERSION_KEY];
    const isNewerFormat = typeof persistenceVersion === 'number' && persistenceVersion > MODEL_PERSISTENCE_VERSION;
    const isSingleModelFormat = persistenceVersion === MODEL_PERSISTENCE_VERSION || isNewerFormat;
    const modelId = isSingleModelFormat ? currentModelId : (legacyModelId ?? currentModelId);

    if (isNewerFormat || (isSingleModelFormat && legacyKeys.length === 0)) {
      if (modelId) await onResolved?.(modelId, persistedMetadata);
      return modelId;
    }
    if (!modelId && legacyKeys.length === 0) return undefined;

    if (modelId) await set('currentModelId', modelId);
    for (const key of legacyKeys) await set(key, undefined);
    await set(MODEL_PERSISTENCE_VERSION_KEY, MODEL_PERSISTENCE_VERSION);
    if (modelId) await onResolved?.(modelId, persistedMetadata);

    return modelId;
  });
}

/**
 * Internal thread-metadata keys used by `Session.loadMetadata()` to persist
 * runtime bookkeeping (selected model/mode, observer/reflector config, token
 * usage). These share the flat thread `metadata` bag with user-provided
 * session scoping tags, so they must never be treated as tags: they are
 * skipped when stamping tags onto a thread and excluded when reading tags
 * back out of thread metadata.
 */
const RESERVED_THREAD_METADATA_KEYS = [
  'currentModelId',
  MODEL_PERSISTENCE_VERSION_KEY,
  MODE_ID_KEY,
  'observerModelId',
  'reflectorModelId',
  'observerModelSelection',
  'reflectorModelSelection',
  'observationThreshold',
  'reflectionThreshold',
  'tokenUsage',
  ...PERSISTED_STATE_KEYS,
] as const;

/** Packages that cannot import the list as a value pin their copy to it with `satisfies Record<ReservedThreadMetadataKey, true>`. */
export type ReservedThreadMetadataKey = (typeof RESERVED_THREAD_METADATA_KEYS)[number];

function isReservedThreadMetadataKey(key: string): boolean {
  // Legacy per-mode model keys remain reserved and read-only so existing threads can restore their model.
  return RESERVED_THREAD_METADATA_KEYS.some(reserved => reserved === key) || key.startsWith('modeModelId_');
}

/**
 * Identifies an in-memory session host. A session is not a durable conversation:
 * it is the process-local handle for `{ id, resourceId, scope, tags, active threadId }`.
 * Conversation settings and run state belong to the active thread and are
 * re-derived whenever the host creates or switches threads.
 *
 * `defaultResourceId` is the resourceId the host started with; switching to a
 * different resource (e.g. impersonation, or browsing another user's threads)
 * updates the current resourceId while the default is retained so the host can
 * return to its original resource.
 *
 * `id` and `ownerId` are stable host identity fields. They are not persisted by
 * AgentController and do not describe ownership of any particular thread. The
 * active thread binding lives on {@link SessionThread}.
 */
export class SessionIdentity {
  /** The memory resourceId the session currently reads/writes under. */
  #resourceId: string;
  /** The resourceId the session started with, retained across resource switches. */
  readonly #defaultResourceId: string;
  /** Stable identifier for this process-local session host. */
  readonly #id: string;
  /** Stable identity attached to this process-local session host. */
  readonly #ownerId: string;

  constructor({ resourceId, id, ownerId }: { resourceId: string; id: string; ownerId: string }) {
    this.#resourceId = resourceId;
    this.#defaultResourceId = resourceId;
    this.#id = id;
    this.#ownerId = ownerId;
  }

  /** The resourceId the session currently reads/writes under. */
  getResourceId(): string {
    return this.#resourceId;
  }

  /** The resourceId the session started with. */
  getDefaultResourceId(): string {
    return this.#defaultResourceId;
  }

  /** The stable session identifier for this session. */
  getId(): string {
    return this.#id;
  }

  /** The stable owner identifier for this session. */
  getOwnerId(): string {
    return this.#ownerId;
  }

  /** Point the session at a different resourceId (the default is unchanged). */
  setResourceId({ resourceId }: { resourceId: string }): void {
    this.#resourceId = resourceId;
  }
}

/**
 * The shared-host storage surface the Session's thread domain leverages to read
 * and write threads. The AgentController backs this with its memory storage (mapping raw
 * storage rows to {@link AgentControllerThread}/{@link MastraDBMessage}); when no storage
 * is configured the handle is absent and the data methods degrade gracefully
 * (empty lists, undefined settings, no-op writes).
 *
 * This is a gateway to shared infrastructure — not a callback into AgentController
 * orchestration. The Session owns the thread-domain logic; the host owns the DB.
 */
export interface ThreadDataStore {
  /** List threads for a resource (or all resources), already mapped + filtered of forked subagents unless asked. */
  listThreads(input: {
    resourceId?: string;
    includeForkedSubagents?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<AgentControllerThread[]>;
  /** Fetch a single thread by id, or null when it doesn't exist. */
  getById(input: { threadId: string }): Promise<AgentControllerThread | null>;
  /** List messages for a thread, newest-`limit` (returned oldest-first) or all. */
  listMessages(input: { threadId: string; limit?: number }): Promise<StorageListMessagesOutput>;
  /** The first user message for each given thread id. */
  firstUserMessages(input: { threadIds: string[] }): Promise<Map<string, MastraDBMessage>>;
  /** Read a value from a thread's metadata. */
  getMetadata(input: { threadId: string; key: string }): Promise<unknown>;
  /** Write a value into a thread's metadata. */
  setMetadata(input: { threadId: string; key: string; value: unknown }): Promise<void>;
  /** Delete a value from a thread's metadata. */
  deleteMetadata(input: { threadId: string; key: string }): Promise<void>;
  /** Whether the host has thread storage configured. When false, lifecycle persistence is a no-op. */
  hasStorage(): boolean;
  /** Persist a new or updated thread row. No-op when storage is unavailable. */
  saveThread(input: { thread: AgentControllerThread }): Promise<void>;
  /**
   * Delete a thread by id from controller storage and, when memory is resolved
   * per caller, from that caller's memory too. No-op when storage is unavailable.
   */
  deleteThread(input: { threadId: string; requestContext?: RequestContext }): Promise<void>;
  /** Clone a thread (and its messages) via the host's memory, returning the new thread. */
  cloneThread(input: {
    sourceThreadId: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
    /** The caller's context, so a dynamic memory resolves for the caller's user. */
    requestContext?: RequestContext;
  }): Promise<AgentControllerThread>;
  /** Acquire the host thread lock for a thread id. No-op when no lock is configured. */
  acquireLock(threadId: string): Promise<void>;
  /** Release the host thread lock for a thread id. No-op when no lock is configured. */
  releaseLock(threadId: string): Promise<void>;
  /** The host's configured mode ids, used to validate a thread's persisted mode on restore. */
  getModeIds(): string[];
}

/**
 * The AgentController-owned machinery a Session leverages to drive an agent run. In the
 * multi-user host one AgentController serves many sessions; the run loop, run state, and
 * thread stream are per-session (they cannot be shared) and so belong on the
 * Session. But *how* a run is produced — which agent answers, the config-backed
 * run/stream options, the toolset, the request context, the tool-approval
 * policy, usage persistence, id generation — is shared infrastructure the
 * AgentController owns. The AgentController injects this machinery into each Session it
 * constructs (via {@link Session.setMachinery}); the Session calls into it but
 * never reaches back into the AgentController or another session.
 *
 * This is the formalized DI boundary: the Session receives exactly the
 * capabilities it is allowed to use, nothing more.
 */
export interface SessionMachinery {
  /** Resolve the agent that should answer for the session's current mode/model. */
  getAgent(): Agent;
  getAgents?(): Iterable<Agent>;
  /** Get the ephemeral state associated with an active or suspended run. */
  getRunScope(runId: string): RunScope | undefined;
  /** Open a fresh subscription to a thread's agent event stream. */
  subscribeToThread(input: {
    agent?: Agent;
    resourceId: string;
    threadId: string;
    requestContext?: RequestContext;
  }): Promise<AgentThreadSubscription<any, true>>;
  /** Build the per-call stream options (instructions, memory, toolsets, abort signal, tracing). */
  buildStreamOptions(input: {
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    untilIdle?: boolean | { maxIdleMs?: number };
    /** Queue preparation owns this signal instead of mutating the active Session run. */
    abortSignal?: AbortSignal;
    /**
     * Thread the run should read and write, when it is not the session's current
     * one — a claimed thread being woken by a peer, for instance. Memory and
     * request-context thread bindings follow this value.
     */
    threadId?: string;
  }): Promise<Record<string, unknown>>;
  /** The run budget every initial stream and resume must carry (maxSteps, provider fallbacks, …). */
  buildSharedRunOptions(requestContext?: RequestContext): Record<string, unknown>;
  onSessionDeleted?(listener: () => void): () => void;
  /** Resolve the toolset (built-in controller  tools + user/subagent tools) for a run. */
  buildToolsets(requestContext: RequestContext): Promise<ToolsetsInput>;
  /** Resolve the effective request context for a run, layering controller defaults. */
  buildRequestContext(
    requestContext?: RequestContext,
    scope?: {
      abortSignal?: AbortSignal;
      resourceId?: string;
      threadId?: string;
      modeId?: string;
      runId?: string;
      execution?: boolean;
    },
  ): Promise<RequestContext>;
  /** Authorize an actor-driven operation before it changes session state. */
  authorizeExecute?(requestContext?: RequestContext): Promise<void>;
  /** Persist the session's running token usage to thread metadata. */
  persistTokenUsage(): Promise<void>;
  /** Generate a new id (thread ids, message ids) using the host's id strategy. */
  generateId(): string;
  /**
   * Resolve the mode the session transitions to when a plan is approved: the
   * supplied mode's `transitionsTo`, else the host's default mode. Returns
   * `undefined` when the host has no default mode. The mode catalog is AgentController
   * config, so this is genuinely host-owned.
   */
  resolveTransitionModeId(modeId: string): string | undefined;
  /**
   * Persist a system-reminder message to a thread, returning the saved message
   * (or `null` when no storage is configured). Pure host-owned persistence
   * (storage handle + id strategy).
   */
  saveSystemReminder(input: {
    threadId: string;
    resourceId: string;
    message: string;
    reminderType: string;
    role: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
  }): Promise<MastraDBMessage | null>;
}

/**
 * Owns the session's thread domain: the navigational binding (which thread the
 * session is currently on) plus the data reads/queries scoped to it. `null`
 * until the session is bound (a thread is created, switched to, or reacquired on
 * startup); switching/deleting updates it.
 *
 * In the multi-user model each session has its own current thread and reads its
 * own threads, while the AgentController host shares storage, the thread lock, and the
 * event bus. So the binding + data queries are per-session and live here; the
 * session leverages the host's storage via an injected {@link ThreadDataStore}.
 * Lifecycle *transitions* (create/switch/clone/delete) remain host machinery
 * because they drive the shared event bus and rebind the shared agent stream.
 */
export class SessionThread {
  /** The active thread id, or null when the session is not bound to a thread. */
  #threadId: string | null = null;
  /** Fences async hydration and queued state writes across binding changes. */
  #bindingGeneration = 0;
  /** Gateway to the host's shared thread storage, injected via {@link connect}. */
  #store: ThreadDataStore | undefined;
  /** Reads the session's current resourceId (sibling identity state). */
  readonly #getResourceId: () => string;
  /**
   * The owning session, injected via {@link connect}. Thread lifecycle
   * transitions (create/switch/clone/delete) orchestrate sibling session
   * subsystems (model/mode/om/state/stream/run/usage/event bus) plus rebind the
   * agent subscription, so the thread domain reaches its peers through this
   * back-reference. Host-owned primitives (storage, lock, clone) stay behind the
   * injected {@link ThreadDataStore}.
   */
  #session: Session | undefined;
  /** Serializes create/clone/switch/delete so bindings and locks commit in call order. */
  #lifecycleQueue: Promise<void> | undefined;
  #hasBoundThread = false;

  constructor(getResourceId: () => string) {
    this.#getResourceId = getResourceId;
  }

  /**
   * Attach the shared-host storage gateway the thread domain reads/writes
   * through and the owning session whose subsystems lifecycle transitions
   * orchestrate. The AgentController calls this once during wiring; without a store the
   * data methods degrade gracefully.
   */
  connect(store: ThreadDataStore | undefined, session: Session): void {
    this.#store = store;
    this.#session = session;
  }

  /** The owning session, throwing when accessed before {@link connect}. */
  get #owner(): Session {
    if (!this.#session) {
      throw new Error('SessionThread has not been connected to its session');
    }
    return this.#session;
  }

  #runLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const predecessor = this.#lifecycleQueue;
    let release!: () => void;
    const tail = new Promise<void>(resolve => {
      release = resolve;
    });
    this.#lifecycleQueue = tail;

    return (async () => {
      try {
        if (predecessor) await predecessor;
        return await operation();
      } finally {
        release();
        if (this.#lifecycleQueue === tail) this.#lifecycleQueue = undefined;
      }
    })();
  }

  /** The active thread id, or null when the session is not bound to a thread. */
  getId(): string | null {
    return this.#threadId;
  }

  /** Whether the session is currently bound to a thread. */
  isSet(): boolean {
    return this.#threadId !== null;
  }

  /** The active thread id, throwing when the session is not bound to a thread. */
  requireId(): string {
    if (this.#threadId === null) {
      throw new Error('No active thread on this session');
    }
    return this.#threadId;
  }

  /**
   * The active thread id, creating and binding a new thread when the session
   * is unbound. Concurrent callers share one creation.
   */
  async ensureId({ requestContext }: { requestContext?: RequestContext } = {}): Promise<string> {
    if (!this.#lifecycleQueue && this.#threadId !== null) return this.#threadId;
    return this.#runLifecycle(async () => {
      if (this.#threadId !== null) return this.#threadId;
      return (await this.#create({ requestContext })).id;
    });
  }

  /**
   * Bind the session directly to a thread and reset its live projection.
   *
   * Prefer {@link create}, {@link clone}, or {@link switch}; direct binding is
   * rejected while a serialized lifecycle transition is pending.
   */
  set({ threadId }: { threadId: string }): number {
    if (this.#lifecycleQueue) {
      throw new Error('Cannot set the active thread during a thread lifecycle transition');
    }
    return this.#set({ threadId });
  }

  #set({
    threadId,
    preserveStartupSelection = false,
  }: {
    threadId: string;
    preserveStartupSelection?: boolean;
  }): number {
    this.#threadId = threadId;
    this.#hasBoundThread = true;
    this.#bindingGeneration++;
    if (this.#session) {
      if (preserveStartupSelection) {
        // First materialization adopts the pending choices without resetting them.
        (this.#session.state as SessionState).rebind([]);
      } else {
        this.#resetThreadSelection();
        this.#session.resetThreadDerivedState();
      }
      this.#session.resetTokenUsage();
    }
    return this.#bindingGeneration;
  }

  #resetThreadSelection(): void {
    const session = this.#session;
    if (!session) return;
    const previousModeId = session.mode.get();
    const previousModelId = session.model.get();
    session.resetThreadSelection();
    const modeId = session.mode.get();
    const modelId = session.model.get();
    if (modeId !== previousModeId) {
      session.emit({ type: 'mode_changed', modeId, previousModeId });
    }
    if (modelId !== previousModelId) {
      session.emit({
        type: 'model_changed',
        modelId,
        thinkingLevel: (session.state.get() as Record<string, unknown>).thinkingLevel as
          | AgentControllerThinkingLevel
          | undefined,
      });
    }
  }

  /**
   * Clear the session's thread binding and reset its live projection.
   *
   * Prefer lifecycle methods; direct clearing is rejected while a serialized
   * lifecycle transition is pending.
   */
  clear(): void {
    if (this.#lifecycleQueue) {
      throw new Error('Cannot clear the active thread during a thread lifecycle transition');
    }
    this.#clear();
  }

  #clear(): void {
    this.#threadId = null;
    this.#bindingGeneration++;
    if (this.#session) {
      this.#resetThreadSelection();
      this.#session.resetThreadDerivedState();
      this.#session.resetTokenUsage();
    }
  }

  /** Whether an async operation still targets the current thread binding. */
  #isCurrentBinding(threadId: string, bindingGeneration: number): boolean {
    return this.#threadId === threadId && this.#bindingGeneration === bindingGeneration;
  }

  /** Serialize teardown with thread lifecycle work, then clear the binding and release its lock. */
  clearAndReleaseLock(): Promise<void> {
    return this.#runLifecycle(() => this.#clearAndReleaseLock());
  }

  async #clearAndReleaseLock({ ignoreReleaseFailure = false }: { ignoreReleaseFailure?: boolean } = {}): Promise<void> {
    const threadId = this.#threadId;
    this.cleanupSubscription();
    this.#clear();
    if (threadId) {
      try {
        await this.#store?.releaseLock(threadId);
      } catch (error) {
        if (!ignoreReleaseFailure) throw error;
      }
    }
  }

  /** Serialize a resource transition with thread lifecycle work. */
  setResourceId({ resourceId }: { resourceId: string }): Promise<void> {
    return this.#runLifecycle(async () => {
      await this.#clearAndReleaseLock({ ignoreReleaseFailure: true });
      this.#owner.identity.setResourceId({ resourceId });
    });
  }

  // ---------------------------------------------------------------------------
  // Data domain: reads/queries scoped to this session, backed by host storage.
  // ---------------------------------------------------------------------------

  /** List this session's threads (its own resource by default, or all resources). */
  async list(options?: {
    allResources?: boolean;
    includeForkedSubagents?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<AgentControllerThread[]> {
    if (!this.#store) {
      return [];
    }
    const resourceId = options?.allResources ? undefined : this.#getResourceId();
    const threads = await this.#store.listThreads({
      resourceId,
      includeForkedSubagents: options?.includeForkedSubagents,
      metadata: options?.metadata,
    });
    return threads;
  }

  /** Fetch a single thread by id, or null when it doesn't exist / no storage. */
  async getById({ threadId }: { threadId: string }): Promise<AgentControllerThread | null> {
    if (!this.#store) return null;
    return this.#store.getById({ threadId });
  }

  /** Clone a detected cross-resource project thread into this session's resource. */
  cloneToCurrentResource(options: {
    threadId: string;
    expectedResourceId: string;
    expectedProjectPath: string;
    requestContext?: RequestContext;
  }): Promise<AgentControllerThread> {
    return this.#runLifecycle(() => this.#cloneToCurrentResource(options));
  }

  async #cloneToCurrentResource({
    threadId,
    expectedResourceId,
    expectedProjectPath,
    requestContext,
  }: {
    threadId: string;
    expectedResourceId: string;
    expectedProjectPath: string;
    requestContext?: RequestContext;
  }): Promise<AgentControllerThread> {
    if (!this.#store?.hasStorage()) {
      throw new Error('Memory is not configured on this AgentController');
    }
    const thread = await this.#store.getById({ threadId });
    if (
      !thread ||
      thread.resourceId !== expectedResourceId ||
      thread.metadata?.projectPath !== expectedProjectPath ||
      expectedResourceId === this.#getResourceId()
    ) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    return this.#cloneThread({
      sourceThreadId: thread.id,
      resourceId: this.#getResourceId(),
      title: thread.title,
      metadata: thread.metadata,
      requestContext,
    });
  }

  /**
   * Load a thread and verify it belongs to this session's resourceId before
   * allowing access. Threads owned by another resource are treated as missing
   * so a session can never read, switch to, rename, or delete a thread it does
   * not own (the thread id is otherwise an unguessable but unscoped key). Throws
   * `Thread not found: <id>` when the thread is absent or owned by someone else.
   */
  async #requireOwnedThread({ threadId }: { threadId: string }): Promise<AgentControllerThread> {
    const thread = await this.#store?.getById({ threadId });
    if (!thread || thread.resourceId !== this.#getResourceId()) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    return thread;
  }

  /** List messages for a thread (newest-`limit`, returned oldest-first), or all. */
  async listMessages({ threadId, limit }: { threadId: string; limit?: number }): Promise<MastraDBMessage[]> {
    if (!this.#store) return [];
    // Only expose messages for threads this session owns.
    await this.#requireOwnedThread({ threadId });
    return (await this.#store.listMessages({ threadId, limit })).messages;
  }

  /** List messages for the session's active thread (empty when not bound). */
  async listActiveMessages({ limit }: { limit?: number } = {}): Promise<MastraDBMessage[]> {
    if (this.#threadId === null) return [];
    return this.listMessages({ threadId: this.#threadId, limit });
  }

  /** The first user message for a single thread, or null. */
  async firstUserMessage({ threadId }: { threadId: string }): Promise<MastraDBMessage | null> {
    const messages = await this.firstUserMessages({ threadIds: [threadId] });
    return messages.get(threadId) ?? null;
  }

  /** The first user message for each given thread id. */
  async firstUserMessages({ threadIds }: { threadIds: string[] }): Promise<Map<string, MastraDBMessage>> {
    if (!this.#store || threadIds.length === 0) return new Map();
    return this.#store.firstUserMessages({ threadIds });
  }

  /** Read a setting (metadata value) for the active thread. */
  async getSetting({ key }: { key: string }): Promise<unknown> {
    if (this.#threadId === null) return undefined;
    return this.getSettingOn({ threadId: this.#threadId, key });
  }

  /** Read a setting from a specific thread, regardless of the current binding. */
  async getSettingOn({ threadId, key }: { threadId: string; key: string }): Promise<unknown> {
    if (!this.#store) return undefined;
    return this.#store.getMetadata({ threadId, key });
  }

  /** Persist a setting (metadata value) for the active thread. */
  async setSetting({ key, value }: { key: string; value: unknown }): Promise<void> {
    if (this.#threadId === null) return;
    await this.setSettingOn({ threadId: this.#threadId, key, value });
  }

  /** Persist a setting to a specific thread, regardless of the current binding. */
  async setSettingOn({ threadId, key, value }: { threadId: string; key: string; value: unknown }): Promise<void> {
    if (!this.#store) return;
    if (value === undefined) {
      await this.#store.deleteMetadata({ threadId, key });
      return;
    }
    await this.#store.setMetadata({ threadId, key, value });
  }

  /** Delete a setting (metadata value) for the active thread. */
  async deleteSetting({ key }: { key: string }): Promise<void> {
    if (!this.#store || this.#threadId === null) return;
    await this.#store.deleteMetadata({ threadId: this.#threadId, key });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle: transitions that bind/rebind this session to a thread. These
  // orchestrate sibling subsystems (model/mode/om/state/usage/event bus) and the
  // agent subscription via the owning session, and reach host storage/lock/clone
  // through the injected gateway.
  // ---------------------------------------------------------------------------

  /** Tear down the current agent subscription and reset the run tracker. */
  cleanupSubscription(): void {
    this.#owner.cleanupFollowUpBinding();
    if (this.#owner.suspensions.hasPending()) {
      // A suspended run is durable thread state. Unsubscribe this host without
      // aborting the parked run so the thread can be resumed after switching back.
      this.#owner.stream.detach();
    } else {
      // A submitted action may not have produced an observed chunk yet. Cancel
      // this session's own startup signal, never the thread's unknown active run.
      if (!this.#owner.run.getRunId() && this.#owner.run.isRunning()) {
        this.#owner.run.requestAbort();
      }
      this.#owner.stream.cleanup();
    }
    this.#owner.run.supersedeBinding();
    this.#owner.run.reset();
  }

  /**
   * Ensure the session is subscribed to the given agent/thread stream, opening a
   * fresh subscription (and driving its run loop) when the binding changed.
   */
  async ensureSubscription(
    threadId: string,
    agent = this.#owner.machinery.getAgent(),
    requestContext?: RequestContext,
    resourceId = this.#getResourceId(),
    shouldAttach?: () => boolean,
  ): Promise<void> {
    const session = this.#owner;
    const key = SessionStream.keyFor({ agent, resourceId, threadId });
    if (session.stream.matches({ key })) {
      session.ensureFollowUpBinding(agent, resourceId, threadId);
      return;
    }
    if (shouldAttach && !shouldAttach()) return;

    this.cleanupSubscription();
    const subscription = await session.machinery.subscribeToThread({ agent, resourceId, threadId, requestContext });
    if (shouldAttach && !shouldAttach()) {
      subscription.unsubscribe();
      return;
    }
    session.stream.attach({ subscription, agent, key, resourceId, threadId });
    session.ensureFollowUpBinding(agent, resourceId, threadId);
    session.stream.trackConsumer(subscription, session.processSubscribedThreadStream(subscription));
  }

  /** Ensure a subscription for the session's active thread (no-op when unbound). */
  async ensureCurrentSubscription(requestContext?: RequestContext): Promise<void> {
    if (this.#threadId === null) return;
    await this.ensureSubscription(this.#threadId, undefined, requestContext);
  }

  /**
   * Detach this host from the current thread without changing durable run state.
   * Pending suspension prompts are removed from the host projection and can be
   * rebuilt when a session binds the thread again.
   */
  detachFromCurrent(): void {
    const hadPendingSuspensions = this.#owner.displayState.get().pendingSuspensions.size > 0;
    this.#owner.displayState.clearPendingSuspensions();
    this.cleanupSubscription();
    if (hadPendingSuspensions) {
      this.#owner.emit({ type: 'display_state_changed', displayState: this.#owner.displayState.get() });
    }
  }

  /** Create a new thread, bind the session to it, and rebind the agent stream. */
  create(
    options: { title?: string; id?: string; requestContext?: RequestContext } = {},
  ): Promise<AgentControllerThread> {
    return this.#runLifecycle(() => this.#create(options));
  }

  async #create({
    title,
    id,
    requestContext,
  }: {
    title?: string;
    id?: string;
    requestContext?: RequestContext;
  }): Promise<AgentControllerThread> {
    const session = this.#owner;
    const store = this.#store;
    const now = new Date();
    const thread: AgentControllerThread = {
      id: id ?? session.machinery.generateId(),
      resourceId: session.identity.getResourceId(),
      title: title || '',
      createdAt: now,
      updatedAt: now,
    };

    const preserveStartupSelection = !this.#hasBoundThread;
    const modeId = preserveStartupSelection ? session.mode.get() : session.mode.getDefault();
    const mode = session.mode.resolveId(modeId);
    const modelId =
      (preserveStartupSelection ? session.model.get() : session.model.getDefault()) || mode.defaultModelId;

    const metadata: Record<string, unknown> = { [MODE_ID_KEY]: modeId };
    if (preserveStartupSelection) {
      const state = session.state.get() as Record<string, unknown>;
      for (const key of threadDerivedStateKeys(state)) {
        if (state[key] !== undefined) metadata[key] = state[key];
      }
    }
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[MODEL_PERSISTENCE_VERSION_KEY] = MODEL_PERSISTENCE_VERSION;
    }

    // Stamp the session's scope so thread selection can filter listings back to
    // it (e.g. a `projectPath` per git worktree).
    Object.assign(metadata, session.getThreadScope());

    // Acquire lock on new thread before releasing old one.
    // If acquire fails, attempt to re-acquire the old lock before rethrowing.
    const oldThreadId = this.#threadId;
    if (store) {
      try {
        await store.acquireLock(thread.id);
      } catch (err) {
        if (oldThreadId) {
          try {
            await store.acquireLock(oldThreadId);
          } catch {
            // Best-effort re-acquire; original error is more important
          }
        }
        throw err;
      }
      if (oldThreadId) {
        try {
          await store.releaseLock(oldThreadId);
        } catch {
          // Best-effort release of the old lock; the new lock is already held.
        }
      }
    }

    if (store?.hasStorage()) {
      try {
        await store.saveThread({
          thread: {
            id: thread.id,
            resourceId: thread.resourceId,
            title: thread.title!,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          },
        });
      } catch (err) {
        // saveThread failed after lock was swapped; restore previous lock state.
        try {
          await store.releaseLock(thread.id);
        } catch {
          // Best-effort release of new thread lock
        }
        if (oldThreadId) {
          try {
            await store.acquireLock(oldThreadId);
          } catch {
            this.cleanupSubscription();
            this.#clear();
          }
        }
        throw err;
      }
    }

    this.cleanupSubscription();
    this.#set({ threadId: thread.id, preserveStartupSelection });

    if (modelId) {
      session.model.set({ modelId });
    }
    session.emit({ type: 'thread_created', thread });
    await this.ensureCurrentSubscription(requestContext);

    return thread;
  }

  /**
   * Rename the session's active thread. No-op when unbound or storageless.
   *
   * Renames pin the title by default (`metadata.titlePinned`) so Observational
   * Memory's title extractor cannot overwrite a user's manual rename. Pass
   * `pin: false` for programmatic title writes that should keep auto-naming.
   */
  async rename({ title, pin = true }: { title: string; pin?: boolean }): Promise<void> {
    const store = this.#store;
    const threadId = this.#threadId;
    if (!threadId || !store?.hasStorage()) return;

    const thread = await store.getById({ threadId });
    if (thread) {
      await store.saveThread({
        thread: {
          ...thread,
          title,
          metadata: { ...thread.metadata, [TITLE_PINNED_THREAD_METADATA_KEY]: pin },
          updatedAt: new Date(),
        },
      });
      this.#owner.emit({ type: 'thread_title_updated', threadId, title });
    }
  }

  /** Clone a thread (and its messages), bind the session to the clone, and rebind the stream. */
  clone(
    options: {
      sourceThreadId?: string;
      title?: string;
      resourceId?: string;
      requestContext?: RequestContext;
    } = {},
  ): Promise<AgentControllerThread> {
    return this.#runLifecycle(() => this.#clone(options));
  }

  async #clone({
    sourceThreadId,
    title,
    resourceId,
    requestContext,
  }: {
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
    requestContext?: RequestContext;
  }): Promise<AgentControllerThread> {
    const sourceId = sourceThreadId ?? this.#threadId;
    if (!sourceId) {
      throw new Error('No source thread to clone');
    }
    // Only allow cloning from a source thread this session owns.
    if (this.#store?.hasStorage()) {
      await this.#requireOwnedThread({ threadId: sourceId });
    }
    return this.#cloneThread({
      sourceThreadId: sourceId,
      resourceId: resourceId ?? this.#owner.identity.getResourceId(),
      title,
      requestContext,
    });
  }

  async #cloneThread({
    sourceThreadId,
    resourceId,
    title,
    metadata,
    requestContext,
  }: {
    sourceThreadId: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
    requestContext?: RequestContext;
  }): Promise<AgentControllerThread> {
    const session = this.#owner;
    const store = this.#store;
    if (!store) {
      throw new Error('Memory is not configured on this AgentController');
    }

    const clonedThread = await store.cloneThread({ sourceThreadId, resourceId, title, metadata, requestContext });

    // Acquire lock on new thread before releasing old one
    const oldThreadId = this.#threadId;
    try {
      await store.acquireLock(clonedThread.id);
    } catch (err) {
      if (oldThreadId) {
        try {
          await store.acquireLock(oldThreadId);
        } catch {
          // Best-effort re-acquire; original error is more important
        }
      }
      throw err;
    }
    if (oldThreadId) {
      await store.releaseLock(oldThreadId);
    }

    this.cleanupSubscription();
    this.#set({ threadId: clonedThread.id });
    await this.loadMetadata({ preserveTokenUsageOnFailure: false });
    session.resetTokenUsage();
    session.emit({ type: 'thread_created', thread: clonedThread });
    await this.ensureCurrentSubscription(requestContext);

    return clonedThread;
  }

  /** Switch the session to an existing thread, hydrating its persisted settings and rebinding the stream. */
  switch(options: { threadId: string; emitEvent?: boolean; requestContext?: RequestContext }): Promise<void> {
    return this.#runLifecycle(() => this.#switch(options));
  }

  async #switch({
    threadId,
    emitEvent = true,
    requestContext,
  }: {
    threadId: string;
    emitEvent?: boolean;
    requestContext?: RequestContext;
  }): Promise<void> {
    const session = this.#owner;
    const store = this.#store;

    // Acquire lock on new thread before releasing old one.
    // Lock operations must be adjacent (no intermediate awaits) so callers
    // can rely on a single microtask tick to observe both acquire and release.
    await store?.acquireLock(threadId);
    const previousThreadId = this.#threadId;
    if (previousThreadId) {
      await store?.releaseLock(previousThreadId);
    }

    // Verify the thread exists and belongs to this session's resourceId before
    // binding to it, so a session can never switch onto a thread owned by
    // another resource. Release the just-acquired lock if the check fails so we
    // never leave a foreign thread locked.
    if (store?.hasStorage()) {
      try {
        await this.#requireOwnedThread({ threadId });
      } catch (err) {
        // Release the just-acquired foreign lock and restore the previous
        // thread's lock so the still-bound session is not left unlocked.
        await store.releaseLock(threadId).catch(() => {});
        if (previousThreadId) {
          await store.acquireLock(previousThreadId).catch(() => {});
        }
        throw err;
      }
    }

    this.cleanupSubscription();
    const bindingGeneration = this.#set({ threadId });

    await this.loadMetadata({ preserveTokenUsageOnFailure: false });
    if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;

    if (emitEvent) {
      session.emit({ type: 'thread_changed', threadId, previousThreadId });
    }
    await this.ensureCurrentSubscription(requestContext);
  }

  /** Delete a thread; when it's the active thread, clear the binding and tear down the run. */
  delete(options: { threadId: string; requestContext?: RequestContext }): Promise<void> {
    return this.#runLifecycle(() => this.#delete(options));
  }

  async #delete({ threadId, requestContext }: { threadId: string; requestContext?: RequestContext }): Promise<void> {
    const session = this.#owner;
    const store = this.#store;
    if (!store?.hasStorage()) return;

    // Only allow deleting threads this session owns.
    await this.#requireOwnedThread({ threadId });

    const isDeletingCurrentThread = this.#threadId === threadId;

    await store.deleteThread({ threadId, requestContext });
    session.suspensions.deleteForThread({ threadId });

    if (isDeletingCurrentThread) {
      try {
        await store.releaseLock(threadId);
      } catch {
        // Lock release failed; proceed with state cleanup regardless
      }
      this.cleanupSubscription();
      this.#clear();
      session.resetTokenUsage();
    }

    session.emit({ type: 'thread_deleted', threadId });
  }

  /**
   * Hydrate the session's per-thread settings from the active thread's metadata:
   * token usage, the persisted mode (restored first), the selected model, and
   * observer/reflector model ids + thresholds. Best-effort: on any failure the
   * token tally is reset and the rest is left at defaults.
   */
  async loadMetadata({
    preserveTokenUsageOnFailure = true,
  }: { preserveTokenUsageOnFailure?: boolean } = {}): Promise<void> {
    const session = this.#owner;
    const store = this.#store;
    const threadId = this.#threadId;
    const bindingGeneration = this.#bindingGeneration;
    if (!threadId || !store?.hasStorage()) {
      session.resetThreadSelection();
      session.resetThreadDerivedState();
      session.resetTokenUsage();
      return;
    }

    if (!preserveTokenUsageOnFailure) session.resetTokenUsage();

    try {
      const thread = await store.getById({ threadId });
      if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;

      const previousModeId = session.mode.get();
      const previousModelId = session.model.get();
      session.resetThreadSelection();
      session.resetThreadDerivedState();

      const meta = thread?.metadata as Record<string, unknown> | undefined;
      const savedUsage = meta?.tokenUsage as TokenUsage | undefined;
      if (savedUsage) {
        session.setTokenUsage({
          ...createEmptyTokenUsage(),
          ...savedUsage,
          promptTokens: savedUsage.promptTokens ?? 0,
          completionTokens: savedUsage.completionTokens ?? 0,
          totalTokens: savedUsage.totalTokens ?? 0,
          cachedInputTokens: savedUsage.cachedInputTokens ?? 0,
          cacheCreationInputTokens: savedUsage.cacheCreationInputTokens ?? 0,
        });
      } else {
        session.resetTokenUsage();
      }

      const savedModeId = meta?.currentModeId;
      if (typeof savedModeId === 'string' && store.getModeIds().includes(savedModeId)) {
        session.mode.set({ modeId: savedModeId });
      }

      const updates: Record<string, unknown> = {};
      // Restore schema prerequisites before validating persisted preferences.
      // Observer/reflector selection intent is restored with its IDs; a legacy
      // concrete ID without a selection remains an explicit selection.
      const observerSelection = meta?.observerModelSelection;
      if (typeof observerSelection === 'string') {
        updates.observerModelSelection = observerSelection;
        updates.observerModelId = observerSelection === 'auto' ? undefined : observerSelection;
      } else if (typeof meta?.observerModelId === 'string') {
        updates.observerModelId = meta.observerModelId;
        updates.observerModelSelection = meta.observerModelId;
      }
      const reflectorSelection = meta?.reflectorModelSelection;
      if (typeof reflectorSelection === 'string') {
        updates.reflectorModelSelection = reflectorSelection;
        updates.reflectorModelId = reflectorSelection === 'auto' ? undefined : reflectorSelection;
      } else if (typeof meta?.reflectorModelId === 'string') {
        updates.reflectorModelId = meta.reflectorModelId;
        updates.reflectorModelSelection = meta.reflectorModelId;
      }
      const hasObservationThreshold = typeof meta?.observationThreshold === 'number';
      const hasReflectionThreshold = typeof meta?.reflectionThreshold === 'number';
      if (hasObservationThreshold) updates.observationThreshold = meta.observationThreshold;
      if (hasReflectionThreshold) updates.reflectionThreshold = meta.reflectionThreshold;

      if (Object.keys(updates).length > 0) {
        try {
          await (session.state as SessionState).hydrate(updates, () =>
            this.#isCurrentBinding(threadId, bindingGeneration),
          );
        } catch {
          // Old OM overrides must not prevent restoring the model selection.
        }
        if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;
      }

      const currentModeId = session.mode.get();
      const persistedModelId = await migratePersistedModelSelection({
        getMetadata: async () =>
          ((await store.getById({ threadId }))?.metadata as Record<string, unknown> | undefined) ?? {},
        modeId: currentModeId,
        onResolved: async (modelId, metadata) => {
          if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;
          session.model.set({ modelId });
          const thinkingLevel = metadata.thinkingLevel;
          if (thinkingLevel !== undefined) {
            try {
              await (session.state as SessionState).hydrate({ thinkingLevel }, () =>
                this.#isCurrentBinding(threadId, bindingGeneration),
              );
            } catch {
              // Ignore preferences no longer accepted by the state schema.
            }
          }
        },
        set: (key, value) => this.setSettingOn({ threadId, key, value }),
        threadId,
        validModeIds: store.getModeIds(),
      });
      if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;
      if (!persistedModelId) {
        const currentMode = session.mode.resolve();
        if (currentMode.defaultModelId) {
          session.model.set({ modelId: currentMode.defaultModelId });
        }
      }

      const modeId = session.mode.get();
      const modelId = session.model.get();
      if (modeId !== previousModeId) {
        session.emit({ type: 'mode_changed', modeId, previousModeId });
      }
      if (modelId !== previousModelId) {
        session.emit({
          type: 'model_changed',
          modelId,
          thinkingLevel: (session.state.get() as Record<string, unknown>).thinkingLevel as
            | AgentControllerThinkingLevel
            | undefined,
        });
      }

      for (const key of [...PERSISTED_STATE_KEYS, ...Object.keys(meta ?? {}).filter(isSubagentModelKey)]) {
        if (key === 'thinkingLevel' && persistedModelId) continue;
        const value = meta?.[key];
        if (value === undefined) continue;
        try {
          await (session.state as SessionState).hydrate({ [key]: value }, () =>
            this.#isCurrentBinding(threadId, bindingGeneration),
          );
        } catch {
          // Persisted preference no longer valid for the current state schema.
        }
        if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;
      }

      if (!hasObservationThreshold) {
        const observationThreshold = session.om.observer.threshold();
        if (observationThreshold !== undefined) {
          await this.setSettingOn({ threadId, key: 'observationThreshold', value: observationThreshold });
        }
      }
      if (!this.#isCurrentBinding(threadId, bindingGeneration)) return;
      if (!hasReflectionThreshold) {
        const reflectionThreshold = session.om.reflector.threshold();
        if (reflectionThreshold !== undefined) {
          await this.setSettingOn({ threadId, key: 'reflectionThreshold', value: reflectionThreshold });
        }
      }
    } catch {
      // Explicit same-thread refreshes preserve live thread-derived state on
      // transient read failures. Lifecycle rebinds reset usage before loading
      // so a prior thread's tally cannot leak into the new projection.
    }
  }
}

/**
 * Owns the session's live subscription to the active thread's agent event
 * stream. A subscription is created per `(agent, resource, thread)` and reused
 * while that triple is unchanged (tracked by {@link key}); switching threads or
 * agents tears the old one down and opens a new one.
 *
 * The Session owns the subscription *handle* and its dedup key plus the
 * mechanical lifecycle (reuse check, teardown, identity check, run-id read).
 * The AgentController still owns *how* a subscription is produced (calling the agent)
 * and *how* its stream is consumed, passing the resolved handle in via
 * {@link attach}.
 */
export class SessionStream {
  /** The live subscription to the active thread, or null when none is open. */
  #subscription: AgentThreadSubscription<any, true> | null = null;
  /** Agent that created the live subscription, or null when none is open. */
  #agent: Agent | null = null;
  /** Dedup key (`agentId:resourceId:threadId`) for the open subscription, or null. */
  #key: string | null = null;
  /** Durable binding owned by the open subscription. */
  #binding: { resourceId: string; threadId: string } | null = null;
  readonly #teardownWaiters = new Set<() => void>();
  readonly #consumerFailureWaiters = new Set<(error: unknown) => void>();
  /** Set once the live subscription's run loop has failed; cleared on attach. */
  #consumerFailure: { error: unknown } | null = null;

  constructor(private readonly getSessionRun: () => { sessionId: string; runId: string | null }) {}

  #notifyTeardown(): void {
    const waiters = [...this.#teardownWaiters];
    this.#teardownWaiters.clear();
    for (const waiter of waiters) waiter();
  }

  /**
   * Track the run loop consuming `subscription`. If it rejects while no other
   * subscription has replaced it, consumer-failure waiters receive the error, so
   * callers awaiting a run on this stream don't wait on a loop that is gone.
   */
  trackConsumer(subscription: AgentThreadSubscription<any, true>, consumer: Promise<void>): void {
    consumer.catch((error: unknown) => {
      if (this.#subscription !== null && this.#subscription !== subscription) return;
      this.#consumerFailure = { error };
      const waiters = [...this.#consumerFailureWaiters];
      this.#consumerFailureWaiters.clear();
      for (const waiter of waiters) waiter(error);
    });
  }

  /** Rejects with the live run loop's error if it fails; resolves when `signal` cancels the wait. */
  waitForConsumerFailure(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      };
      const abort = () => {
        this.#consumerFailureWaiters.delete(done);
        resolve();
      };
      if (signal.aborted) return resolve();
      if (this.#consumerFailure) return reject(this.#consumerFailure.error);
      this.#consumerFailureWaiters.add(done);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  waitForTeardown(signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      const done = () => {
        signal.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        this.#teardownWaiters.delete(done);
        resolve();
      };
      if (signal.aborted) return resolve();
      this.#teardownWaiters.add(done);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  /** Build the dedup key identifying a subscription to `threadId` for `agent`. */
  static keyFor({ agent, resourceId, threadId }: { agent: Agent; resourceId: string; threadId: string }): string {
    return `${agent.id}:${resourceId}:${threadId}`;
  }

  /** Whether the open subscription already targets `key` (so it can be reused). */
  matches({ key }: { key: string }): boolean {
    // A subscription whose run loop failed can't process further runs; re-attach.
    return this.#key === key && this.#subscription !== null && this.#consumerFailure === null;
  }

  /** Adopt `subscription` as the live one, recording its owning agent and dedup `key`. */
  attach({
    subscription,
    agent,
    key,
    resourceId,
    threadId,
  }: {
    subscription: AgentThreadSubscription<any, true>;
    agent?: Agent;
    key: string;
    resourceId: string;
    threadId: string;
  }): void {
    this.#subscription = subscription;
    this.#agent = agent ?? null;
    this.#key = key;
    this.#binding = { resourceId, threadId };
    this.#consumerFailure = null;
  }

  /** Agent that owns `subscription`, when it is the live subscription. */
  getAgent({ subscription }: { subscription: AgentThreadSubscription<any, true> }): Agent | null {
    return this.#subscription === subscription ? this.#agent : null;
  }

  /** Durable binding owned by `subscription`, when it is the live subscription. */
  getBinding({ subscription }: { subscription: AgentThreadSubscription<any, true> }): {
    resourceId: string;
    threadId: string;
  } | null {
    return this.#subscription === subscription ? this.#binding : null;
  }

  /** Whether a subscription is currently open. */
  isOpen(): boolean {
    return this.#subscription !== null;
  }

  /** Whether `subscription` is the one currently adopted (identity check). */
  isCurrent({ subscription }: { subscription: AgentThreadSubscription<any, true> }): boolean {
    return this.#subscription === subscription;
  }

  /** The run id the live subscription reports as active, or null when none/idle. */
  activeRunId(): string | null {
    return this.#subscription?.activeRunId() ?? null;
  }

  /** Whether the live subscription currently has a run in flight. */
  isActive(): boolean {
    return this.activeRunId() !== null;
  }

  /**
   * Abort the live subscription's in-flight run, if any. Swallows errors.
   * `localOnly` keeps an abort caused by a thread lifecycle transition (detach,
   * switch) from asking a remote thread owner to stop its run.
   */
  abort(options?: { localOnly?: boolean }): void {
    try {
      this.#subscription?.abort(options);
    } catch {}
  }

  /** Detach the live subscription without aborting (e.g. on stream error). */
  detach(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#agent = null;
    this.#key = null;
    this.#binding = null;
    this.#notifyTeardown();
  }

  /** Tear down this binding, cancelling only an execution initiated by this session. */
  cleanup(): void {
    const { sessionId, runId } = this.getSessionRun();
    const origin = this.#subscription?.__getCurrentRunRequestContext?.()?.get('controller') as
      | AgentControllerRequestContext
      | undefined;
    // The subscription exposes the original execution context, not this listener's
    // reconstructed context. Fence stale readers against a newer action on the thread.
    if (runId && this.#subscription?.activeRunId() === runId && origin?.session.id === sessionId) {
      this.#subscription.abort({ localOnly: true });
    }
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#agent = null;
    this.#key = null;
    this.#binding = null;
    this.#notifyTeardown();
  }
}

/** Immutable identity of a tool call parked awaiting a resume. */
export interface SuspensionAddress {
  /** The thread the suspended invocation was persisted under. */
  threadId: string;
  /** The memory resource the suspended invocation was persisted under. */
  resourceId: string;
  /** The run id to resume when this tool call is answered. */
  runId: string;
  /** The suspended tool call id. */
  toolCallId: string;
}

/** A tool call parked awaiting a resume, keyed in {@link SessionSuspensions}. */
export interface PendingSuspension extends SuspensionAddress {
  /** The suspended tool's name (e.g. `ask_user`, `submit_plan`). */
  toolName: string;
}

export function getSuspensionAddressKey({ resourceId, threadId, runId, toolCallId }: SuspensionAddress): string {
  return JSON.stringify([resourceId, threadId, runId, toolCallId]);
}

/**
 * Owns the session's parked tool suspensions: tool calls paused via the native
 * tool-suspension primitive (e.g. `ask_user` / `request_access` / `submit_plan`)
 * that are awaiting a resume, keyed by `(threadId, runId, toolCallId)`. Each entry
 * records the run id to resume and the tool name. A Map lets several
 * tools — e.g. parallel `ask_user` calls in one step — stay suspended and be
 * resumed independently.
 *
 * This is the resume *data* the AgentController reads to drive a resume. The richer
 * per-suspension UI snapshot lives on the AgentController display state; the Session
 * owns only what's needed to resume.
 */
export class SessionSuspensions {
  /** Parked tool calls awaiting a resume, keyed by `(threadId, runId, toolCallId)`. */
  readonly #pending = new Map<string, { toolCallId: string } & PendingSuspension>();
  readonly #getActiveBinding: (() => { resourceId: string; threadId: string | null }) | undefined;

  constructor(getActiveBinding?: () => { resourceId: string; threadId: string | null }) {
    this.#getActiveBinding = getActiveBinding;
  }

  #activeEntries(): Array<[string, { toolCallId: string } & PendingSuspension]> {
    if (!this.#getActiveBinding) return [...this.#pending];
    const { resourceId, threadId } = this.#getActiveBinding();
    if (threadId === null) return [];
    return [...this.#pending].filter(
      ([, suspension]) => suspension.resourceId === resourceId && suspension.threadId === threadId,
    );
  }

  /**
   * Park `toolCallId` as awaiting a resume on `runId` for `toolName`, recording
   * the thread/resource the suspended invocation was persisted under. When the
   * same tool call is replayed for the same run (e.g. a resumed stream re-emits
   * the suspension), the original thread/resource binding is preserved so later
   * settlement still targets where the invocation was first persisted.
   */
  register({
    toolCallId,
    runId,
    toolName,
    threadId,
    resourceId,
  }: {
    toolCallId: string;
    runId: string;
    toolName: string;
    threadId: string;
    resourceId: string;
  }): void {
    const key = getSuspensionAddressKey({ resourceId, threadId, runId, toolCallId });
    const existing = this.#pending.get(key);
    if (existing) {
      this.#pending.set(key, { ...existing, toolName });
      return;
    }
    this.#pending.set(key, { toolCallId, runId, toolName, threadId, resourceId });
  }

  /** Resolve one active-thread suspension, rejecting ambiguous partial addresses. */
  resolve({ toolCallId, runId }: { toolCallId?: string; runId?: string } = {}): PendingSuspension | undefined {
    const matches = this.#activeEntries()
      .map(([, suspension]) => suspension)
      .filter(suspension => toolCallId === undefined || suspension.toolCallId === toolCallId)
      .filter(suspension => runId === undefined || suspension.runId === runId);
    return matches.length === 1 ? matches[0] : undefined;
  }

  /** Read a suspension by exact address, or by an unambiguous active-thread selector. */
  get(address: SuspensionAddress | { toolCallId: string; runId?: string }): PendingSuspension | undefined {
    if ('threadId' in address) return this.#pending.get(getSuspensionAddressKey(address));
    return this.resolve(address);
  }

  /** Whether an exact or unambiguous suspension is currently parked. */
  has(address: SuspensionAddress | { toolCallId: string; runId?: string }): boolean {
    return this.get(address) !== undefined;
  }

  /** Drop exactly one parked suspension; ambiguous partial addresses are ignored. */
  delete(address: SuspensionAddress | { toolCallId: string; runId?: string }): void {
    const resolved = 'threadId' in address ? address : this.resolveAddress(address);
    if (resolved) this.#pending.delete(getSuspensionAddressKey(resolved));
  }

  /**
   * Drop every suspension parked on `runId`, returning the dropped toolCallIds.
   * Used when a run reaches a terminal failure after emitting `tool_suspended`
   * (e.g. persisting the suspended snapshot failed): those suspensions can never
   * be resumed, so keeping them parked would leave the user with prompts whose
   * answers fail with a misleading "could not find a suspended run" error.
   * Suspensions parked on other runs are left intact.
   */
  deleteForRun({
    resourceId,
    threadId,
    runId,
  }: {
    resourceId: string;
    threadId: string;
    runId: string;
  }): PendingSuspension[] {
    const dropped: PendingSuspension[] = [];
    for (const [key, suspension] of this.#pending) {
      if (suspension.resourceId === resourceId && suspension.threadId === threadId && suspension.runId === runId) {
        this.#pending.delete(key);
        dropped.push({ ...suspension });
      }
    }
    return dropped;
  }

  /** Discard the in-memory suspension mirror for a deleted thread. */
  deleteForThread({ threadId }: { threadId: string }): void {
    for (const [key, suspension] of this.#pending) {
      if (suspension.threadId === threadId) this.#pending.delete(key);
    }
  }

  /**
   * Drop every suspension parked on the active thread, returning the dropped
   * entries with their original thread/resource binding. Suspensions for other
   * threads remain available when the host switches back.
   */
  clear(): Array<{ toolCallId: string } & PendingSuspension> {
    const dropped = this.#activeEntries().map(([, suspension]) => ({ ...suspension }));
    for (const [key] of this.#activeEntries()) this.#pending.delete(key);
    return dropped;
  }

  /** Whether the active thread has tool calls parked awaiting a resume. */
  hasPending(): boolean {
    return this.#activeEntries().length > 0;
  }

  /**
   * Resolve which active-thread suspension to act on. A partial address only
   * succeeds when it identifies exactly one parked suspension.
   */
  resolveAddress({ toolCallId, runId }: { toolCallId?: string; runId?: string } = {}): SuspensionAddress | undefined {
    const suspension = this.resolve({ toolCallId, runId });
    if (!suspension) return undefined;
    const { threadId, resourceId, runId: resolvedRunId, toolCallId: resolvedToolCallId } = suspension;
    return { threadId, resourceId, runId: resolvedRunId, toolCallId: resolvedToolCallId };
  }

  /** @deprecated Use {@link resolveAddress} to retain the complete suspension identity. */
  resolveToolCallId(toolCallId?: string): string | undefined {
    return this.resolveAddress({ toolCallId })?.toolCallId;
  }
}

/** A message queued to send once the active run finishes, held in {@link SessionFollowUps}. */
export interface FollowUp {
  /** The message text to send. */
  content: string;
  /** Optional request context to apply when the queued message is sent. */
  requestContext?: RequestContext;
}

/**
 * Owns the session's follow-up queue: messages a user submits while a run is in
 * progress, held FIFO until the active run finishes and the queue is drained.
 *
 * This owns the queue *data* (enqueue/dequeue/requeue/clear/count). The AgentController
 * still drives draining — sending each message and emitting `follow_up_queued`
 * as the count changes — and keeps the display-state mirror (`queuedFollowUps`).
 */
export class SessionFollowUps {
  /** Messages waiting to be sent after the current run, in arrival order. */
  #queue: FollowUp[] = [];

  /** Number of messages currently queued. */
  count(): number {
    return this.#queue.length;
  }

  /** Whether the queue is empty. */
  isEmpty(): boolean {
    return this.#queue.length === 0;
  }

  /** Append a follow-up to the back of the queue. */
  enqueue(followUp: FollowUp): void {
    this.#queue.push(followUp);
  }

  /** Remove and return the next follow-up, or undefined when empty. */
  dequeue(): FollowUp | undefined {
    return this.#queue.shift();
  }

  /** Put a follow-up back at the front (e.g. when draining it failed). */
  requeue(followUp: FollowUp): void {
    this.#queue.unshift(followUp);
  }

  /** Drop all queued follow-ups (e.g. on steer or thread switch). */
  clear(): void {
    this.#queue = [];
  }
}

/** The decision a user returns to resolve a parked tool-approval gate. */
export interface ApprovalDecision {
  /** Whether to run the gated tool or reject it. */
  decision: 'approve' | 'decline';
  /** Optional request context to apply when the gated tool resumes. */
  requestContext?: RequestContext;
  /** Optional context explaining why a tool approval was declined. */
  declineContext?: { reason?: string; message?: string };
}

/**
 * Whether a tool approval/suspension response was claimed by a pending target.
 * `accepted: true` only means the command was taken, not that the resumed tool
 * later succeeded.
 */
export type SessionCommandResult =
  | { accepted: true }
  | { accepted: false; reason: 'not_pending' | 'stale_tool_call' | 'aborting' | 'no_pending_suspension' };

/**
 * A user's response to a parked approval. `always_allow_category` approves the
 * tool and additionally grants its category for the rest of the session.
 */
export interface ApprovalResponse {
  decision: 'approve' | 'decline' | 'always_allow_category';
  requestContext?: RequestContext;
  declineContext?: { reason?: string; message?: string };
}

/** A single parked interactive approval gate, scoped to the call that opened it. */
interface ApprovalGate {
  toolCallId: string;
  toolName: string;
  /** Thread that produced the gated call, when the producer knew it. */
  threadId?: string;
  /** Run that produced the gated call, when the producer knew it. */
  runId?: string;
  promise: Promise<ApprovalDecision>;
  resolve: (decision: ApprovalDecision) => void;
}

/**
 * Narrows which parked gate(s) an operation applies to. A field the filter
 * *names* is a constraint, so `{ threadId: undefined }` selects the gates the
 * producer left untagged rather than every gate — a caller with no thread
 * binding must not release a detached thread's gate. Omitted fields constrain
 * nothing.
 */
interface ApprovalGateFilter {
  toolCallId?: string;
  threadId?: string;
  runId?: string;
}

/**
 * Owns the session's interactive tool-approval gates: when a tool requires user
 * approval, the run parks on a promise here until the UI responds approve or
 * decline.
 *
 * Gates retain the tool call and thread/run that opened them. Bare call-ID
 * responses are rejected when more than one owner has that ID. More than one gate can be parked at once — a background/sub-agent run on a
 * detached thread arms its own gate while the foreground run arms another — so
 * arming never overwrites or strands an existing gate, and a response can only
 * release the gate it names. Thread-scoped callers (abort, a user-message
 * interjection) release only their own thread's gate, so one thread can never
 * mutate another thread's approval authority.
 *
 * The Session owns the gate mechanics (arm / respond / cancel); the
 * AgentController still maps a decision to its effects (running vs declining the
 * tool, and any "always allow" grant), since those touch config-derived tool
 * categories.
 */
export class SessionApproval {
  /** Parked gates retain their full thread/run ownership, even when call IDs repeat. */
  #gates = new Set<ApprovalGate>();

  /**
   * Park an approval for `toolCallId` and return a promise that resolves once
   * {@link respond} or {@link cancel} releases it. The caller awaits this while
   * the run is suspended on the gate. Re-arming the same call returns the
   * already-parked promise rather than replacing its resolver, so a duplicate
   * arm can never strand the first waiter.
   */
  arm({
    toolName,
    toolCallId,
    threadId,
    runId,
  }: {
    toolName: string;
    toolCallId: string;
    threadId?: string;
    runId?: string;
  }): Promise<ApprovalDecision> {
    const existing = [...this.#gates].find(
      gate => gate.toolCallId === toolCallId && gate.threadId === threadId && gate.runId === runId,
    );
    if (existing) return existing.promise;

    let resolve!: (decision: ApprovalDecision) => void;
    const promise = new Promise<ApprovalDecision>(r => {
      resolve = r;
    });
    this.#gates.add({ toolCallId, toolName, threadId, runId, promise, resolve });
    return promise;
  }

  /**
   * Whether a gate is parked. With no filter this is true when *any* gate is
   * parked; with a filter it is true only when a gate matches every supplied
   * field, so callers can ask "is my thread/run parked?" without seeing another
   * thread's gate.
   */
  isArmed(filter?: ApprovalGateFilter): boolean {
    if (!filter) return this.#gates.size > 0;
    return this.#matching(filter).length > 0;
  }

  /** Ids of the parked gates that match `filter` (or every gate when omitted). */
  getToolCallIds(filter?: ApprovalGateFilter): string[] {
    return (filter ? this.#matching(filter) : [...this.#gates.values()]).map(gate => gate.toolCallId);
  }

  /**
   * Apply a user's {@link ApprovalResponse} to the gate named by `toolCallId`.
   * A no-op for an id that is not parked, so a missing *or* stale id can never
   * resolve a different pending gate. `always_allow_category` runs
   * `onAlwaysAllow` with the gated tool name and the gate's thread (so the
   * caller can grant the tool's category to the thread that owns the gate — a
   * lookup that needs AgentController config) and then approves;
   * `approve`/`decline` resolve as-is.
   */
  respond({
    decision,
    toolCallId,
    requestContext,
    declineContext,
    onAlwaysAllow,
  }: ApprovalResponse & {
    toolCallId: string;
    onAlwaysAllow?: (toolName: string, threadId?: string) => void;
  }): SessionCommandResult {
    const matches = this.#matching({ toolCallId });
    if (matches.length !== 1) {
      return { accepted: false, reason: this.#gates.size > 0 ? 'stale_tool_call' : 'not_pending' };
    }
    const gate = matches[0]!;

    if (decision === 'always_allow_category') {
      onAlwaysAllow?.(gate.toolName, gate.threadId);
    }

    this.#gates.delete(gate);
    gate.resolve({
      decision: decision === 'decline' ? 'decline' : 'approve',
      requestContext,
      declineContext,
    });
    return { accepted: true };
  }

  /**
   * Release parked gate(s) without a user decision — on abort, or when a user
   * message interrupts a run. Each is resolved as a `decline` so the gated tool
   * is rejected (not run) and the run can finalize. `filter` narrows the release
   * to a specific call, thread, or run (so aborting one thread cannot decline
   * another's gate): naming `threadId`/`runId` with an undefined value — a
   * caller with no thread binding — releases only the untagged gates rather than
   * every gate. With no filter every gate is released. Returns the ids that were
   * released.
   */
  cancel(options: ApprovalGateFilter & { declineContext?: { reason?: string; message?: string } } = {}): string[] {
    const gates = this.#matching(options);
    for (const gate of gates) {
      this.#gates.delete(gate);
      gate.resolve({ decision: 'decline', declineContext: options.declineContext });
    }
    return gates.map(gate => gate.toolCallId);
  }

  /**
   * Parked gates matching every field `filter` *names*. For the optional gate
   * tags (thread/run) a named field is a constraint even when its value is
   * undefined: `{ threadId: undefined }` matches the gates the producer left
   * untagged, which is what a caller with no thread binding must be limited to,
   * since a gate tagged with another thread is that thread's authority to
   * release. `toolCallId` is always present on a gate, so an unset one imposes
   * no constraint.
   *
   * A gate that never recorded the field a filter names is treated as matching:
   * it cannot be attributed to a *different* thread, and stranding it would hang
   * the run it belongs to.
   */
  #matching(filter: ApprovalGateFilter): ApprovalGate[] {
    const matched: ApprovalGate[] = [];
    for (const gate of this.#gates.values()) {
      if (filter.toolCallId !== undefined && gate.toolCallId !== filter.toolCallId) continue;
      if ('threadId' in filter && gate.threadId !== undefined && gate.threadId !== filter.threadId) continue;
      if ('runId' in filter && gate.runId !== undefined && gate.runId !== filter.runId) continue;
      matched.push(gate);
    }
    return matched;
  }
}

/**
 * Owns the session's transient run identity and abort control: the id of the
 * run currently streaming on the active thread, its trace id, a monotonic
 * operation counter bumped each time a new operation starts, and the
 * AbortController/abort-requested flag governing cancellation. All of this is
 * per-run scratch state — it is never persisted and resets between runs.
 *
 * The live agent subscription itself lives on {@link SessionStream}
 * (`session.stream`); this holds the last run id observed on a chunk so callers
 * have a stable value once the subscription has settled.
 */
export class SessionRun {
  /** Id of the run currently streaming on the active thread, or null when idle. */
  #runId: string | null = null;
  /** Trace id for the current run, or null when unset. */
  #traceId: string | null = null;
  /** Monotonic counter bumped at the start of each operation. */
  #operationId = 0;
  /** Bumped when the thread binding is torn down; see {@link bindingGeneration}. */
  #bindingGeneration = 0;
  /** Controller whose signal cancels the active run; null when no run is armed. */
  #abortController: AbortController | null = null;
  /** Whether an abort has been requested for the current run. */
  #abortRequested = false;
  /** Incremented on every abort request, so waiters can ignore earlier ones. */
  #abortGeneration = 0;
  readonly #teardownWaiters = new Set<() => void>();
  readonly #abortRequestWaiters = new Set<() => void>();

  #notifyTeardown(): void {
    const waiters = [...this.#teardownWaiters];
    this.#teardownWaiters.clear();
    for (const waiter of waiters) waiter();
  }

  waitForTeardown(signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      const done = () => {
        signal.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        this.#teardownWaiters.delete(done);
        resolve();
      };
      if (signal.aborted) return resolve();
      this.#teardownWaiters.add(done);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  #notifyAbortRequested(): void {
    const waiters = [...this.#abortRequestWaiters];
    this.#abortRequestWaiters.clear();
    for (const waiter of waiters) waiter();
  }

  /** Generation of the latest abort request; pass to {@link waitForAbortRequest} as `after`. */
  getAbortGeneration(): number {
    return this.#abortGeneration;
  }

  /**
   * Resolves once an abort is requested for the current run (immediately if
   * one already was), or when `signal` cancels the wait. With `after`, only an
   * abort requested after that generation counts.
   */
  waitForAbortRequest(signal: AbortSignal, { after }: { after?: number } = {}): Promise<void> {
    const requested = () => (after === undefined ? this.#abortRequested : this.#abortGeneration > after);
    return new Promise(resolve => {
      const done = () => {
        signal.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        this.#abortRequestWaiters.delete(done);
        resolve();
      };
      if (requested() || signal.aborted) return resolve();
      this.#abortRequestWaiters.add(done);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  /** The current run id (null when idle). */
  getRunId(): string | null {
    return this.#runId;
  }

  /** Set the current run id. */
  setRunId({ runId }: { runId: string | null }): void {
    this.#runId = runId;
  }

  /** The current trace id (null when unset). */
  getTraceId(): string | null {
    return this.#traceId;
  }

  /** Set the current trace id. */
  setTraceId({ traceId }: { traceId: string | null }): void {
    this.#traceId = traceId;
  }

  /**
   * Clear all run state (run id, trace id, abort controller + requested flag)
   * when a run ends or is reset. Does not touch the operation counter.
   */
  reset(): void {
    this.#runId = null;
    this.#traceId = null;
    this.#abortController = null;
    this.#abortRequested = false;
    this.#notifyTeardown();
  }

  /**
   * Generation of the session's thread binding. Bumped whenever the binding is
   * torn down (detach, switch, `/new`, ...), so async work started for one run
   * can tell that the session has since moved on to another.
   */
  bindingGeneration(): number {
    return this.#bindingGeneration;
  }

  /** Mark the current binding as superseded; see {@link bindingGeneration}. */
  supersedeBinding(): void {
    this.#bindingGeneration += 1;
  }

  /** Bump and return the operation counter at the start of a new operation. */
  nextOperation(): number {
    this.#operationId += 1;
    return this.#operationId;
  }

  /**
   * Lazily create (if needed) and return the AbortController for the current
   * run. Callers pass its `.signal` into the underlying stream.
   */
  ensureAbortController(): AbortController {
    this.#abortController ??= new AbortController();
    return this.#abortController;
  }

  /** Signal for the current run's AbortController, or undefined when none is armed. */
  getAbortSignal(): AbortSignal | undefined {
    return this.#abortController?.signal;
  }

  /**
   * Whether a run is currently in progress. A run is armed with an
   * AbortController for its duration, so the presence of one is what "running"
   * means; this is the semantic accessor callers should use.
   */
  isRunning(): boolean {
    return this.#abortController !== null;
  }

  /**
   * Whether an AbortController is currently armed. Equivalent to
   * {@link isRunning} today; kept for callers that assert on the controller's
   * lifecycle specifically (e.g. that it was cleared after an abort).
   */
  hasAbortController(): boolean {
    return this.#abortController !== null;
  }

  /** Clear the abort-requested flag at the start of a fresh run. */
  clearAbortRequested(): void {
    this.#abortRequested = false;
  }

  /** Whether an abort has been requested for the current run. */
  isAbortRequested(): boolean {
    return this.#abortRequested;
  }

  /**
   * Request an abort: mark the run as aborting and fire the AbortController (if
   * armed), then drop the controller. Leaves the requested flag set so the
   * run-end path can resolve its reason as 'aborted'; {@link reset} clears it.
   *
   * `deferSignal` marks the run as aborting without firing the controller. Used
   * when the abort interrupts a parked tool-approval gate: the gated call still
   * has to be declined through the (still live) agent run so the denial is
   * persisted, and firing the signal first would tear that run down underneath
   * the decline. The engine fires the signal itself once the decline lands.
   */
  requestAbort({ deferSignal }: { deferSignal?: boolean } = {}): void {
    this.#abortRequested = true;
    this.#abortGeneration++;
    if (deferSignal) {
      this.#notifyAbortRequested();
      return;
    }
    if (this.#abortController) {
      try {
        this.#abortController.abort();
      } catch {}
      this.#abortController = null;
    }
    this.#notifyAbortRequested();
  }
}

/**
 * Owns the session's currently-selected model. Source of truth for which model
 * is active and responsible for persisting that one selection per thread.
 */
type ThinkingLevelSwitch = (
  level: unknown,
  commit: (() => Promise<void>) | undefined,
  isActive: () => boolean,
  applyModel: () => void,
) => Promise<boolean>;

export class SessionModel {
  #id = '';
  #defaultId: string | undefined;
  readonly #store: () => ThreadSettingsStore | undefined;
  /** This session's event bus; {@link switch} emits `model_changed` here. */
  readonly #bus: SessionBus;
  /** Reads the active mode id for the legacy per-mode restore fallback. */
  #getCurrentModeId: (() => string) | undefined;
  /** Reads configured mode ids so persisted mode metadata can be validated. */
  #getModeIds: (() => string[]) | undefined;
  /** App hook to track model usage for ranking. Injected via {@link setResolver}. */
  #trackModelUse: ModelUseCountTracker | undefined;
  readonly #setThinkingLevel: ThinkingLevelSwitch;
  readonly #getThinkingLevel: () => AgentControllerThinkingLevel | undefined;
  #switchQueue: Promise<void> = Promise.resolve();

  constructor(
    store: () => ThreadSettingsStore | undefined,
    bus: SessionBus,
    setThinkingLevel: ThinkingLevelSwitch,
    getThinkingLevel: () => AgentControllerThinkingLevel | undefined,
  ) {
    this.#store = store;
    this.#bus = bus;
    this.#setThinkingLevel = setThinkingLevel;
    this.#getThinkingLevel = getThinkingLevel;
  }

  /** Attach mode accessors and the optional model-use tracker. */
  setResolver(options: {
    getCurrentModeId: () => string;
    getModeIds: () => string[];
    trackModelUse?: ModelUseCountTracker;
  }): void {
    this.#getCurrentModeId = options.getCurrentModeId;
    this.#getModeIds = options.getModeIds;
    this.#trackModelUse = options.trackModelUse;
  }

  /** The currently-selected model id ('' when none selected yet). */
  get(): string {
    return this.#id;
  }

  /** Whether a model is currently selected. */
  hasSelection(): boolean {
    return this.#id !== '';
  }

  /**
   * A short display name for the selected model: the last segment of the model
   * id (e.g. `__GATEWAY_ANTHROPIC_MODEL_SONNET__` -> `claude-sonnet-4-6`). Returns
   * `'unknown'` when no model is selected.
   */
  displayName(): string {
    const modelId = this.#id;
    if (!modelId || modelId === 'unknown') return modelId || 'unknown';
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  }

  /** Set the in-memory selected model id (no persistence). */
  set({ modelId }: { modelId: string }): void {
    this.#id = modelId;
  }

  /** @internal Record the host-configured model used when resetting or creating threads. */
  setDefault({ modelId }: { modelId: string }): void {
    this.#defaultId = modelId;
  }

  /** Restore the host-configured model before hydrating another thread. */
  reset(): void {
    this.#id = this.#defaultId ?? '';
  }

  /** @internal The host-configured model used to seed a new thread. */
  getDefault(): string {
    return this.#defaultId ?? '';
  }

  /**
   * Re-sync the in-memory model and thinking level from the persisted thread.
   *
   * Unmarked legacy metadata is migrated before the selection is applied. Only
   * emits `model_changed` when either value changes the in-memory selection.
   */
  async syncFromPersisted(): Promise<void> {
    const store = this.#store();
    if (!store) return;
    const threadId = store.getThreadId();
    if (!threadId) return;
    const currentModeId = this.#getCurrentModeId?.() ?? '';
    await migratePersistedModelSelection({
      getMetadata: () => store.getAllOn(threadId),
      modeId: currentModeId,
      onResolved: async (modelId, metadata) => {
        const isActive = () => store.getThreadId() === threadId;
        if (!isActive()) return;
        const previousModelId = this.#id;
        const previousThinkingLevel = this.#getThinkingLevel();
        if (metadata.thinkingLevel !== previousThinkingLevel) {
          if (
            !(await this.#setThinkingLevel(metadata.thinkingLevel, undefined, isActive, () => this.set({ modelId })))
          ) {
            return;
          }
        } else {
          this.set({ modelId });
        }
        if (!isActive()) return;
        const thinkingLevel = this.#getThinkingLevel();
        if (modelId !== previousModelId || thinkingLevel !== previousThinkingLevel) {
          this.#bus.emit({ type: 'model_changed', modelId, thinkingLevel });
        }
      },
      set: (key, value) => store.setOn(threadId, key, value),
      threadId,
      validModeIds: this.#getModeIds?.(),
    });
  }

  /**
   * Switch to a different model at runtime.
   *
   * Persists the selection for the thread, reports it to the model-use tracker,
   * and emits `model_changed` with the current thinking level. When
   * `thinkingLevel` is provided it is applied and persisted with the model
   * (through the session-state preference, which also survives restarts).
   * Rejects if a thread change cancels the switch before any selection is committed.
   */
  async switch(
    modelId: string,
    { thinkingLevel }: { thinkingLevel?: AgentControllerThinkingLevel } = {},
  ): Promise<void> {
    const store = this.#store();
    const threadId = store?.getThreadId();
    const isActive = () => store?.getThreadId() === threadId;
    const run = this.#switchQueue.then(() =>
      runModelPersistenceOperation(threadId, async () => {
        let committed = false;
        const commit = async () => {
          if (threadId) {
            await store?.setModelOn(threadId, {
              currentModelId: modelId,
              [MODEL_PERSISTENCE_VERSION_KEY]: MODEL_PERSISTENCE_VERSION,
              ...(thinkingLevel !== undefined ? { thinkingLevel } : {}),
            });
            committed = true;
          }
        };
        const applyModel = () => {
          this.set({ modelId });
          committed = true;
        };
        if (thinkingLevel !== undefined) {
          if (isActive()) await this.#setThinkingLevel(thinkingLevel, commit, isActive, applyModel);
        } else {
          await commit();
          if (isActive()) applyModel();
        }
        if (!committed) {
          throw new Error('Model switch canceled because the active thread changed');
        }
        if (isActive()) {
          this.#bus.emit({
            type: 'model_changed',
            modelId,
            thinkingLevel: this.#getThinkingLevel(),
          });
        }
      }),
    );
    this.#switchQueue = run.catch(() => undefined);
    await run;

    try {
      await Promise.resolve(this.#trackModelUse?.(modelId));
    } catch (error) {
      console.error('Failed to track model usage count', error);
    }
  }
}

/**
 * Owns the session's currently-selected mode and the logic for switching modes.
 * The AgentController still owns the mode *definitions* (`config.modes`); this
 * owns "which mode is active" and persists that selection without changing the
 * session's model.
 */
export class SessionMode {
  /** Id of the currently-selected mode. Empty until the AgentController resolves its default mode. */
  #id = '';
  #defaultId: string | undefined;
  readonly #store: () => ThreadSettingsStore | undefined;
  /** This session's event bus; {@link switch} emits mode_changed here. */
  readonly #bus: SessionBus;
  /**
   * Resolves a mode id to its full definition. Injected by the AgentController via
   * {@link setResolver}, since the mode *catalog* (`config.modes`) is host config.
   */
  #resolveMode: ((modeId: string) => AgentControllerMode | null) | undefined;
  constructor(store: () => ThreadSettingsStore | undefined, bus: SessionBus) {
    this.#store = store;
    this.#bus = bus;
  }

  /**
   * Attach the resolver that maps a mode id to its definition. The AgentController owns
   * the mode catalog (`config.modes`) and injects this once.
   */
  setResolver(resolve: (modeId: string) => AgentControllerMode | null): void {
    this.#resolveMode = resolve;
  }

  /** The currently-selected mode id. */
  get(): string {
    return this.#id;
  }

  /**
   * Resolve the currently-selected mode id to its full definition against the
   * host's mode catalog. Throws if the selected mode id isn't in the catalog.
   */
  resolve(): AgentControllerMode {
    const mode = this.#resolveMode?.(this.#id) ?? null;
    if (!mode) {
      throw new Error(`Mode not found: ${this.#id}`);
    }
    return mode;
  }

  /** Set the currently-selected mode id (on default resolution or hydration). */
  set({ modeId }: { modeId: string }): void {
    this.#id = modeId;
  }

  /** @internal Record the host-configured mode used when resetting or creating threads. */
  setDefault({ modeId }: { modeId: string }): void {
    this.#defaultId = modeId;
  }

  /** Restore the host-configured mode before hydrating another thread. */
  reset(): void {
    this.#id = this.#defaultId ?? '';
  }

  /** @internal The host-configured mode id used to seed a new thread. */
  getDefault(): string {
    return this.#defaultId ?? '';
  }

  /** @internal Resolve a mode without changing the live selection. */
  resolveId(modeId: string): AgentControllerMode {
    const mode = this.#resolveMode?.(modeId) ?? null;
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }
    return mode;
  }

  /** Switch to a different mode without changing the session's selected model. */
  async switch({ modeId }: { modeId: string }): Promise<void> {
    const mode = this.#resolveMode?.(modeId) ?? null;
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    const previousModeId = this.#id;
    this.#id = modeId;
    this.#bus.emit({ type: 'mode_changed', modeId, previousModeId });
    await this.#store()?.set(MODE_ID_KEY, modeId);
  }
}

/** Per-role wiring + state/config keys a {@link SessionOMRole} reads and writes. */
interface SessionOMRoleConfig {
  /** The event `role` and `om_model_changed` discriminator for this role. */
  role: 'observer' | 'reflector';
  /** Session-state / thread-settings key holding this role's model id. */
  modelIdKey: 'observerModelId' | 'reflectorModelId';
  /** Session-state / thread-settings key holding this role's selection intent. */
  selectionKey: 'observerModelSelection' | 'reflectorModelSelection';
  /** Session-state key holding this role's threshold. */
  thresholdKey: 'observationThreshold' | 'reflectionThreshold';
  /** Resolve this role's default model id from `omConfig`. */
  defaultModelId: (omConfig: AgentControllerOMConfig | undefined) => string | undefined;
  /** Resolve this role's default threshold from `omConfig`. */
  defaultThreshold: (omConfig: AgentControllerOMConfig | undefined) => number | undefined;
}

/**
 * One observational-memory role (observer or reflector): its model id, resolved
 * model instance, threshold, and model switch. Reads return the session-state
 * value when set, falling back to the AgentController's `omConfig` defaults. The shared
 * wiring is injected by {@link SessionOM.setResolver}.
 */
class SessionOMRole {
  readonly #config: SessionOMRoleConfig;
  readonly #bus: SessionBus;
  #getState: (() => Record<string, unknown>) | undefined;
  #getCurrentModelId: (() => string | undefined) | undefined;
  #setState: ((updates: Record<string, unknown>, event?: AgentControllerEvent) => Promise<void>) | undefined;
  #omConfig: AgentControllerOMConfig | undefined;
  #gateways: MastraModelGatewayInterface[] | undefined;

  constructor(config: SessionOMRoleConfig, bus: SessionBus) {
    this.#config = config;
    this.#bus = bus;
  }

  /** @internal Injected by {@link SessionOM.setResolver}. */
  setWiring(wiring: {
    getState: () => Record<string, unknown>;
    getCurrentModelId: () => string | undefined;
    setState: (updates: Record<string, unknown>, event?: AgentControllerEvent) => Promise<void>;
    omConfig?: AgentControllerOMConfig;
    gateways?: MastraModelGatewayInterface[];
  }): void {
    this.#getState = wiring.getState;
    this.#getCurrentModelId = wiring.getCurrentModelId;
    this.#setState = wiring.setState;
    this.#omConfig = wiring.omConfig;
    this.#gateways = wiring.gateways;
  }

  /** This role's configured model. `auto` follows the active main model. */
  model(): OMModel | undefined {
    const state = this.#getState?.() ?? {};
    const selection = state[this.#config.selectionKey];
    if (typeof selection === 'string' && selection.length > 0) return selection;

    const modelId = state[this.#config.modelIdKey];
    if (typeof modelId === 'string') return modelId;

    const configuredModel =
      this.#config.role === 'observer' ? this.#omConfig?.observerModel : this.#omConfig?.reflectorModel;
    return configuredModel ?? this.#config.defaultModelId(this.#omConfig);
  }

  /** This role's effective concrete model id. */
  modelId(): string | undefined {
    return this.#resolveModelId(this.model(), this.#getState?.() ?? {});
  }

  #resolveModelId(model: OMModel | undefined, state: Record<string, unknown>): string | undefined {
    if (model !== 'auto') return model;

    try {
      const resolved = this.#omConfig?.resolveAutoModelId?.({
        role: this.#config.role,
        currentModelId: this.#getCurrentModelId?.(),
        state,
      });
      if (resolved) return resolved;
    } catch {
      // Automatic resolution is fail-soft and falls through to the concrete default.
    }
    return this.#config.defaultModelId(this.#omConfig);
  }

  /** This role's threshold from session state, falling back to `omConfig`. */
  threshold(): number | undefined {
    const fromState = this.#getState?.()[this.#config.thresholdKey];
    return (typeof fromState === 'number' ? fromState : undefined) ?? this.#config.defaultThreshold(this.#omConfig);
  }

  /**
   * Resolve this role's effective model id to a model instance via the
   * configured gateways, or undefined when unset.
   */
  resolvedModel(): MastraModelConfig | undefined {
    const modelId = this.modelId();
    if (!modelId) return undefined;
    return new ModelRouterLanguageModel(modelId as `${string}/${string}`, this.#gateways);
  }

  /** Switch this role's model, persist it, and emit the effective concrete model. */
  async switchModel({ modelId }: { modelId: OMModel }): Promise<void> {
    const updates = {
      [this.#config.selectionKey]: modelId,
      [this.#config.modelIdKey]: modelId === 'auto' ? undefined : modelId,
    };
    const effectiveModelId = this.#resolveModelId(modelId, { ...this.#getState?.(), ...updates });
    const event: AgentControllerEvent | undefined = effectiveModelId
      ? { type: 'om_model_changed', role: this.#config.role, modelId: effectiveModelId }
      : undefined;
    if (this.#setState) await this.#setState(updates, event);
    else if (event) this.#bus.emit(event);
  }
}

/**
 * Owns the session's observational-memory model selection, grouped by role:
 * {@link SessionOM.observer} and {@link SessionOM.reflector}. The AgentController owns
 * `omConfig` and the model resolver, so it injects them — plus the session-state
 * read/write and thread-settings persistence — once via {@link setResolver},
 * which fans the wiring out to both roles.
 */
class SessionOM {
  readonly observer: SessionOMRole;
  readonly reflector: SessionOMRole;

  constructor(bus: SessionBus) {
    this.observer = new SessionOMRole(
      {
        role: 'observer',
        modelIdKey: 'observerModelId',
        selectionKey: 'observerModelSelection',
        thresholdKey: 'observationThreshold',
        defaultModelId: omConfig => omConfig?.defaultObserverModelId,
        defaultThreshold: omConfig => omConfig?.defaultObservationThreshold,
      },
      bus,
    );
    this.reflector = new SessionOMRole(
      {
        role: 'reflector',
        modelIdKey: 'reflectorModelId',
        selectionKey: 'reflectorModelSelection',
        thresholdKey: 'reflectionThreshold',
        defaultModelId: omConfig => omConfig?.defaultReflectorModelId,
        defaultThreshold: omConfig => omConfig?.defaultReflectionThreshold,
      },
      bus,
    );
  }

  /**
   * Attach the session-state read/write, thread-settings persistence, and the
   * AgentController-owned `omConfig` defaults plus model resolver. The AgentController injects
   * these once; the wiring is shared by both roles.
   */
  setResolver(options: {
    getState: () => Record<string, unknown>;
    getCurrentModelId: () => string | undefined;
    setState: (updates: Record<string, unknown>, event?: AgentControllerEvent) => Promise<void>;
    omConfig?: AgentControllerOMConfig;
    gateways?: MastraModelGatewayInterface[];
  }): void {
    this.observer.setWiring(options);
    this.reflector.setWiring(options);
  }
}

/**
 * Owns the session's tool-permission rules: the per-category and per-tool
 * approval policies persisted in session state under `permissionRules`. The
 * AgentController injects the session-state read/write once via {@link setResolver}.
 *
 * These are the persisted rules consulted during tool-approval resolution; they
 * are distinct from the in-memory "allow for this session" grants on the
 * Session.
 */
class SessionPermissions {
  #getState: (() => Record<string, unknown>) | undefined;
  #setState: ((updates: Record<string, unknown>) => Promise<void>) | undefined;

  /** Attach the session-state read/write. The AgentController injects these once. */
  setResolver(options: {
    getState: () => Record<string, unknown>;
    setState: (updates: Record<string, unknown>) => Promise<void>;
  }): void {
    this.#getState = options.getState;
    this.#setState = options.setState;
  }

  /** The current permission rules, or empty rules when none are set. */
  getRules(): PermissionRules {
    const rules = this.#getState?.().permissionRules as PermissionRules | undefined;
    return rules ?? { categories: {}, tools: {} };
  }

  /** Set the approval policy for a tool category. Resolves once persisted. */
  setForCategory({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }): Promise<void> {
    const rules = this.getRules();
    rules.categories[category] = policy;
    return this.#setState?.({ permissionRules: rules }) ?? Promise.resolve();
  }

  /** Set the approval policy for an individual tool. Resolves once persisted. */
  setForTool({ toolName, policy }: { toolName: string; policy: PermissionPolicy }): Promise<void> {
    const rules = this.getRules();
    rules.tools[toolName] = policy;
    return this.#setState?.({ permissionRules: rules }) ?? Promise.resolve();
  }
}

/**
 * How long a message submitted right after an abort waits for the aborted run
 * to finish tearing down before it is dispatched anyway. Real teardown includes
 * stream cancellation and every output processor; a few seconds is normal.
 */
const POST_ABORT_TEARDOWN_TIMEOUT_MS = 30_000;

/** Stamp at submit time: a steer aborts its own run, so the route resolved downstream reads idle. */
function asInterjection(signal: CreatedAgentSignal): CreatedAgentSignal {
  if (signal.type !== 'user' || signal.attributes?.delivery !== undefined) return signal;
  return resolveDeliveryAttributes(signal, { delivery: 'while-active' });
}

/** The session-state / thread-settings key holding a subagent model id. */
function subagentModelKey(agentType?: string): string {
  return agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
}

/**
 * The subagent model selection. Reads prefer the per-`agentType` value and fall
 * back to the global subagent model; writes persist to thread settings and emit
 * a `subagent_model_changed` event. Wiring is injected by
 * {@link SessionSubagents.setResolver}.
 */
class SessionSubagentModel {
  readonly #bus: SessionBus;
  #getState: (() => Record<string, unknown>) | undefined;
  #setState: ((updates: Record<string, unknown>, event: AgentControllerEvent) => Promise<void>) | undefined;

  constructor(bus: SessionBus) {
    this.#bus = bus;
  }

  /** @internal Injected by {@link SessionSubagents.setResolver}. */
  setWiring(wiring: {
    getState: () => Record<string, unknown>;
    setState: (updates: Record<string, unknown>, event: AgentControllerEvent) => Promise<void>;
  }): void {
    this.#getState = wiring.getState;
    this.#setState = wiring.setState;
  }

  /**
   * The subagent model id, preferring the `agentType`-specific value when one is
   * given, then the global subagent model, or `null` when neither is set.
   */
  get({ agentType }: { agentType?: string } = {}): string | null {
    const state = this.#getState?.() ?? {};
    if (agentType) {
      const perType = state[subagentModelKey(agentType)];
      if (typeof perType === 'string') return perType;
    }
    const global = state.subagentModelId;
    return typeof global === 'string' ? global : null;
  }

  /**
   * Set the subagent model id (per-`agentType` when given, otherwise global).
   * Persists to thread settings and emits `subagent_model_changed`.
   */
  async set({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    const key = subagentModelKey(agentType);
    const event: AgentControllerEvent = { type: 'subagent_model_changed', modelId, scope: 'thread', agentType };
    if (this.#setState) await this.#setState({ [key]: modelId }, event);
    else this.#bus.emit(event);
  }
}

/**
 * The session's subagent configuration. Currently exposes the subagent model
 * selection under {@link SessionSubagents.model}; grouped under `subagents` to
 * leave room for additional subagent settings. The AgentController injects the
 * session-state read/write, thread-settings persistence, and event emitter once
 * via {@link setResolver}.
 */
class SessionSubagents {
  readonly model: SessionSubagentModel;

  constructor(bus: SessionBus) {
    this.model = new SessionSubagentModel(bus);
  }

  /**
   * Attach the session-state read/write and thread-settings persistence. The
   * AgentController injects these once.
   */
  setResolver(options: {
    getState: () => Record<string, unknown>;
    setState: (updates: Record<string, unknown>, event: AgentControllerEvent) => Promise<void>;
  }): void {
    this.model.setWiring(options);
  }
}

type SessionStateUpdater<TState, TResult> = AgentControllerRequestStateUpdater<TState, TResult>;

interface SessionStateOptions<TState> {
  initialState?: Partial<TState>;
  stateSchema?: PublicSchema<TState, any>;
}

/**
 * Owns the live AgentController state for a single Session.
 *
 * Reads return shallow snapshots, writes are serialized through a promise queue,
 * and validated updates emit the same `state_changed` event the AgentController used to
 * emit when it owned state directly.
 */
type PersistSettingFn = (args: { key: string; value: unknown }) => Promise<void>;

type StateSource = {
  resourceId: string;
  threadId: string | null;
  preferences: Record<string, unknown>;
  writtenKeys: Set<string>;
  references: number;
  persistSetting?: PersistSettingFn;
  selection?: { modeId: string; modelId: string };
};

/** @internal State implementation shared with controller execution-context wiring. */
export type { SessionState };

class SessionState<TState = unknown> {
  #state: TState;
  readonly #initialState: TState;
  #updateQueue: Promise<void> = Promise.resolve();
  #source: StateSource;
  readonly #sources = new Set<WeakRef<StateSource>>();
  readonly #getBinding: () => { resourceId: string; threadId: string | null };
  readonly #schema: StandardSchemaWithJSON | undefined;
  readonly #bus: SessionBus;
  readonly #capturePersistSetting: (() => PersistSettingFn | undefined) | undefined;

  constructor(
    { initialState, stateSchema }: SessionStateOptions<TState>,
    bus: SessionBus,
    capturePersistSetting?: () => PersistSettingFn | undefined,
    getBinding: () => { resourceId: string; threadId: string | null } = () => ({ resourceId: '', threadId: null }),
    private readonly getSelection: () => { modeId: string; modelId: string } = () => ({ modeId: '', modelId: '' }),
  ) {
    this.#schema = stateSchema ? toStandardSchema(stateSchema) : undefined;
    this.#initialState = {
      ...this.getSchemaDefaults(),
      ...(initialState as Record<string, unknown> | undefined),
    } as TState;
    this.#state = { ...(this.#initialState as Record<string, unknown>) } as TState;
    this.#bus = bus;
    this.#capturePersistSetting = capturePersistSetting;
    this.#getBinding = getBinding;
    this.#source = this.#newSource(this.#state as Record<string, unknown>);
  }

  #newSource(state: Record<string, unknown>): StateSource {
    const source: StateSource = {
      ...this.#getBinding(),
      preferences: Object.fromEntries(threadDerivedStateKeys(state).map(key => [key, state[key]])),
      writtenKeys: new Set(),
      references: 0,
      persistSetting: this.#capturePersistSetting?.(),
    };
    this.#sources.add(new WeakRef(source));
    return source;
  }

  get(): Readonly<TState> {
    return this.#read(this.#source);
  }

  #read(source: StateSource): Readonly<TState> {
    const state = { ...(this.#state as Record<string, unknown>) };
    for (const key of threadDerivedStateKeys({ ...state, ...source.preferences })) {
      if (source.preferences[key] === undefined) delete state[key];
      else state[key] = source.preferences[key];
    }
    return state as TState;
  }

  #pruneSources(): StateSource[] {
    const sources: StateSource[] = [];
    for (const reference of this.#sources) {
      const source = reference.deref();
      if (!source || (source !== this.#source && source.references === 0)) this.#sources.delete(reference);
      else sources.push(source);
    }
    return sources;
  }

  #release(source: StateSource): void {
    source.references--;
    this.#pruneSources();
  }

  captureSelection(): void {
    this.#source.selection = this.getSelection();
  }

  /** Internal source handle. Run-held handles follow runScope reachability; temporary owners may release explicitly. */
  retain(
    input?: {
      resourceId: string;
      threadId: string;
      preferences: Record<string, unknown>;
      selection: { modeId: string; modelId: string };
      persistSetting: PersistSettingFn;
    },
    retain = true,
  ) {
    let source = input
      ? this.#pruneSources().find(
          source => source.resourceId === input.resourceId && source.threadId === input.threadId,
        )
      : this.#source;
    if (!source) {
      source = this.#newSource({ ...(this.#initialState as Record<string, unknown>), ...input!.preferences });
      source.resourceId = input!.resourceId;
      source.threadId = input!.threadId;
      source.persistSetting = input!.persistSetting;
      source.selection = input!.selection;
    }
    const retainedSource = source;
    if (source === this.#source) this.captureSelection();
    if (retain) source.references++;
    let released = false;
    return {
      resourceId: source.resourceId,
      threadId: source.threadId,
      isActive: () => retainedSource === this.#source,
      selection: () => (retainedSource === this.#source ? this.getSelection() : retainedSource.selection!),
      setSelection: (selection: { modeId: string; modelId: string }) => {
        retainedSource.selection = selection;
      },
      emit: (event: AgentControllerEvent) => this.#emitForSource(retainedSource, event),
      get: () => this.#read(retainedSource),
      set: (updates: Partial<TState>) => this.#set(retainedSource, updates),
      update: <TResult>(updater: SessionStateUpdater<TState, TResult>) => this.#update(retainedSource, updater),
      release: () => {
        if (released) return;
        released = true;
        if (retain) this.#release(retainedSource);
      },
    };
  }

  #enqueue<TResult>(source: StateSource, operation: () => Promise<TResult>): Promise<TResult> {
    source.references++;
    const run = this.#updateQueue.then(operation).finally(() => this.#release(source));
    this.#updateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private getSchemaDefaults(): Partial<TState> {
    if (!this.#schema) return {};

    const defaults: Record<string, unknown> = {};

    try {
      // Extract defaults from the JSON Schema representation.
      const jsonSchema = this.#schema['~standard'].jsonSchema.output({ target: 'draft-07' }) as {
        properties?: Record<string, { default?: unknown }>;
      };
      if (jsonSchema?.properties) {
        for (const [key, prop] of Object.entries(jsonSchema.properties)) {
          if (prop.default !== undefined) {
            defaults[key] = prop.default;
          }
        }
      }
    } catch {
      // Schema doesn't support JSON Schema extraction — skip defaults.
    }

    return defaults as Partial<TState>;
  }

  private async apply(
    source: StateSource,
    updates: Partial<TState>,
    persistSetting?: PersistSettingFn,
    shouldApply?: () => boolean,
    commit?: () => Promise<void>,
    onApply?: () => void,
    hydrating = false,
  ): Promise<boolean> {
    if (shouldApply && !shouldApply()) return false;
    const changedKeys = Object.keys(updates as Record<string, unknown>);
    const newState = { ...this.#read(source), ...(updates as Record<string, unknown>) };
    let validatedState: TState;

    if (this.#schema) {
      const result = await this.#schema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map(i => i.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      validatedState = result.value as TState;
    } else {
      validatedState = newState as TState;
    }

    // Re-check after async schema validation, immediately before mutating the
    // live session. Callers use this to prevent a queued update from crossing
    // a session/thread ownership boundary while validation was in flight.
    if (shouldApply && !shouldApply()) return false;
    if (commit) {
      if (
        (validatedState as Record<string, unknown>).thinkingLevel !== (updates as Record<string, unknown>).thinkingLevel
      ) {
        throw new Error('State schema must preserve the selected thinkingLevel');
      }
      await commit();
    }
    if (shouldApply && !shouldApply()) return false;
    onApply?.();
    const state = validatedState as Record<string, unknown>;
    for (const key of threadDerivedStateKeys({ ...source.preferences, ...state })) {
      source.preferences[key] = state[key];
      if (!hydrating && changedKeys.includes(key)) source.writtenKeys.add(key);
    }
    // Only the host portion of a validated snapshot is shared across bindings.
    this.#state = validatedState;
    const visibleKeys = changedKeys.filter(
      key =>
        source === this.#source ||
        (!(THREAD_DERIVED_STATE_KEYS as readonly string[]).includes(key) && !isSubagentModelKey(key)),
    );
    if (visibleKeys.length > 0) {
      this.#bus.emit({ type: 'state_changed', state: this.get() as Record<string, unknown>, changedKeys: visibleKeys });
    }

    const persistedValues: Record<string, unknown> = {};
    for (const key of changedKeys) persistedValues[key] = state[key];
    await this.#persistSettings(persistedValues as Partial<TState>, persistSetting);
    return true;
  }

  rebind(keys: readonly string[]): void {
    const binding = this.#getBinding();
    const previous = this.#source;
    const before = this.get() as Record<string, unknown>;
    const retained = this.#pruneSources().find(
      source => source.resourceId === binding.resourceId && source.threadId === binding.threadId,
    );
    this.#source =
      retained ?? this.#newSource(keys.length === 0 ? before : (this.#initialState as Record<string, unknown>));
    if (previous !== this.#source) this.#pruneSources();
    const after = this.get() as Record<string, unknown>;
    const changedKeys = threadDerivedStateKeys({ ...before, ...after }).filter(key => before[key] !== after[key]);
    if (changedKeys.length > 0) this.#bus.emit({ type: 'state_changed', state: after, changedKeys });
  }

  /** Hydration must not overwrite successful writes held by a warm source view. */
  hydrate(updates: Partial<TState>, shouldApply: () => boolean): Promise<boolean> {
    const source = this.#source;
    return this.#enqueue(source, async () => {
      const pending = Object.fromEntries(
        Object.entries(updates as Record<string, unknown>).filter(([key]) => !source.writtenKeys.has(key)),
      ) as Partial<TState>;
      if (Object.keys(pending).length === 0) return false;
      return this.apply(source, pending, undefined, shouldApply, undefined, undefined, true);
    });
  }

  async #persistSettings(updates: Partial<TState>, persistSetting?: PersistSettingFn): Promise<void> {
    if (!persistSetting) return;
    const values = updates as Record<string, unknown>;
    for (const key of threadDerivedStateKeys(values)) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
      try {
        await persistSetting({ key, value: values[key] });
      } catch {
        // Storage unavailable or write failed — keep the in-memory update.
      }
    }
  }

  set(updates: Partial<TState>): Promise<void> {
    return this.#set(this.#source, updates);
  }

  #set(source: StateSource, updates: Partial<TState>): Promise<void> {
    const snapshot = { ...updates };
    return this.#enqueue(source, async () => {
      if (Object.keys(snapshot).length > 0) await this.apply(source, snapshot, source.persistSetting);
    });
  }

  /** Validate a model preference before applying its model and optionally committing metadata. */
  setWithCommit(
    updates: Partial<TState>,
    commit: (() => Promise<void>) | undefined,
    shouldApply: () => boolean,
    onApply: () => void,
  ): Promise<boolean> {
    const updateSnapshot = { ...updates };
    const source = this.#source;
    return this.#enqueue(source, () => this.apply(source, updateSnapshot, undefined, shouldApply, commit, onApply));
  }

  /** Apply an update only while a caller-owned identity still matches. */
  setIf(updates: Partial<TState>, shouldApply: () => boolean): Promise<boolean> {
    const snapshot = { ...updates };
    const source = this.#source;
    return this.#enqueue(source, () => this.apply(source, snapshot, source.persistSetting, shouldApply));
  }

  update<TResult>(updater: SessionStateUpdater<TState, TResult>): Promise<TResult> {
    return this.#update(this.#source, updater);
  }

  #update<TResult>(source: StateSource, updater: SessionStateUpdater<TState, TResult>): Promise<TResult> {
    return this.#enqueue(source, async () => {
      const update = await updater(this.#read(source));
      if (update.updates && Object.keys(update.updates as Record<string, unknown>).length > 0) {
        await this.apply(source, update.updates, source.persistSetting);
      }
      for (const event of update.events ?? []) this.#emitForSource(source, event);
      return update.result;
    });
  }

  #emitForSource(source: StateSource, event: AgentControllerEvent): void {
    switch (event.type) {
      case 'thread_created':
      case 'thread_deleted':
      case 'thread_title_updated':
      case 'om_thread_title_updated':
      case 'workspace_status_changed':
      case 'workspace_ready':
      case 'workspace_error':
        this.#bus.emit(event);
        return;
      case 'tool_approval_required':
        this.#bus.emit({ ...event, threadId: event.threadId ?? source.threadId ?? undefined });
        return;
      case 'tool_suspended':
      case 'tool_suspension_cancelled':
        this.#bus.emit({
          ...event,
          threadId: event.threadId ?? source.threadId ?? undefined,
          resourceId: event.resourceId ?? source.resourceId,
        });
        return;
      case 'subagent_model_changed':
        if (event.scope === 'global' || source === this.#source) this.#bus.emit(event);
        return;
      default:
        // Legacy display events have no source address. Never present them as B's.
        if (source === this.#source) this.#bus.emit(event);
    }
  }
}

/**
 * A AgentController session owns the per-conversation runtime state that today lives
 * flattened on the {@link AgentController} instance. This class is the seam we extract
 * that state into, one concern at a time, so the AgentController can eventually own a
 * `Session` rather than the state itself.
 *
 * Currently owns:
 * - the live AgentController state (`session.state`): schema-validated snapshots and
 *   serialized updates that emit `state_changed`.
 * - session-scoped permission grants — the "allow for this session" approvals a
 *   user makes when a tool or tool category is gated behind the permission check.
 * - the live token-usage counter for the active thread. The Session holds the
 *   in-memory running tally; the AgentController remains responsible for persisting it
 *   to (and hydrating it from) thread metadata, because usage is thread-scoped.
 * - the currently-selected mode (`session.mode`) and model (`session.model`).
 *   The Session is the source of truth for which mode/model is active and owns
 *   the mode-switch sequence and per-mode model memory. The AgentController still owns
 *   the mode *definitions* (`config.modes`).
 * - transient run identity and abort control (`session.run`): the current run
 *   id, trace id, monotonic operation counter, and the AbortController/
 *   abort-requested flag. This is per-run scratch state and is never persisted.
 * - the live agent thread subscription (`session.stream`): the open
 *   subscription to the active thread's event stream and its dedup key. The
 *   AgentController still produces the subscription (calling the agent) and consumes its
 *   stream; the Session owns the handle and its lifecycle.
 * - the parked tool suspensions (`session.suspensions`): tool calls paused via
 *   the native tool-suspension primitive awaiting a resume, keyed by toolCallId.
 *   The Session owns the resume data; the AgentController keeps the richer per-suspension
 *   UI snapshot on its display state.
 * - follow-up queue observation: a subscription to the Agent-owned FIFO for
 *   the active resource/thread. The Agent runtime schedules messages; the
 *   Session renders its current shared `queuedFollowUps` count. * - the interactive tool-approval gate (`session.approval`): when a tool needs
 *   user approval, the run parks on a promise here until the UI responds. The
 *   Session owns the gate; the AgentController maps the decision to its effects (run vs
 *   decline, any "always allow" grant), which touch config-derived categories.
 *
 * It also exposes a couple of accessors that compose `run` and `stream`:
 * {@link getCurrentRunId} (the active run id, preferring the live subscription)
 * and {@link abortRun} (abort the live run and mark it aborting).
 *
 * Mode/model persistence is thread-scoped, so the Session writes through a
 * {@link ThreadSettingsStore} the AgentController backs with thread metadata; when no
 * storage is configured the store is absent and state stays in memory.
 */
/**
 * Owns the session's canonical display state — the projection a UI renders from
 * instead of folding raw events itself. The Session holds the snapshot and the
 * reducer ({@link apply}) that keeps it in sync with every AgentController event; the
 * AgentController still owns the event bus and dispatches `display_state_changed` to
 * listeners after applying.
 *
 * The reducer needs a few read-only host/session facts it doesn't own: the live
 * token-usage tally, a subagent display-name lookup (AgentController config), and the
 * active thread id (to decide whether a `thread_deleted` clears the view). Those
 * are injected at construction so the reducer stays self-contained.
 */
export class SessionDisplayState {
  #state: AgentControllerDisplayState = defaultDisplayState();

  constructor(
    private readonly deps: {
      /** The session's live token-usage tally, mirrored into the view on usage/thread events. */
      getTokenUsage: () => TokenUsage;
      /** Resolve a subagent's display name from AgentController config, or undefined when unnamed. */
      getSubagentDisplayName: (agentType: string) => string | undefined;
      /** The active thread id, used to gate `thread_deleted` resets. */
      getThreadId: () => string | null;
      /** Clear the session's follow-up queue when thread-scoped display state resets. */
      clearFollowUps: () => void;
    },
  ) {}

  /**
   * A read-only snapshot of the canonical display state. UIs should render from
   * this instead of building state up from raw events.
   */
  get(): Readonly<AgentControllerDisplayState> {
    return this.#state;
  }

  /**
   * Drop the display mirror of every parked tool suspension. Used on abort,
   * which abandons the run's parked suspensions; the caller dispatches
   * `display_state_changed`.
   */
  clearPendingSuspensions(): void {
    this.#state.pendingSuspensions.clear();
  }

  /**
   * Clear the modified-files tally without touching the rest of the snapshot.
   * Used after a clone, which starts the cloned thread with a clean working set
   * while the surrounding UI reset handles tasks/tools explicitly.
   */
  clearModifiedFiles(): void {
    this.#state.modifiedFiles.clear();
  }

  /** Add or update one suspension without conflating duplicate tool-call ids across runs. */
  #setPendingSuspension(
    suspension: AgentControllerDisplayState['pendingSuspensions'] extends Map<string, infer T> ? T : never,
  ): void {
    const pending = this.#state.pendingSuspensions;
    const hasAddress =
      suspension.resourceId !== undefined && suspension.threadId !== undefined && suspension.runId !== undefined;
    if (!hasAddress) {
      pending.set(suspension.toolCallId, suspension);
      return;
    }

    const address = suspension as typeof suspension &
      Required<Pick<typeof suspension, 'resourceId' | 'threadId' | 'runId'>>;
    pending.set(getSuspensionAddressKey(address), suspension);
  }

  /**
   * Drop the display mirror of exactly one parked tool suspension once it has
   * resumed, preserving a sibling that reused the same tool-call id.
   */
  deletePendingSuspension(address: SuspensionAddress): void {
    const pending = this.#state.pendingSuspensions;
    for (const [key, entry] of pending) {
      if (
        entry.toolCallId === address.toolCallId &&
        entry.resourceId === address.resourceId &&
        entry.threadId === address.threadId &&
        entry.runId === address.runId
      ) {
        pending.delete(key);
      }
    }
  }

  /**
   * Restore task display state after a UI replays persisted task-tool history.
   * Updates the snapshot without emitting a live `task_updated` event, since no
   * task tool just ran. The caller dispatches `display_state_changed`.
   */
  restoreTasks(tasks: TaskItemSnapshot[]): void {
    this.#state.previousTasks = [...this.#state.tasks];
    this.#state.tasks = [...tasks];
  }

  /**
   * Reset display fields scoped to a thread. Called on thread switch/creation.
   * Also clears the session's follow-up queue (mirrored by `queuedFollowUps`).
   */
  resetThread(): void {
    const ds = this.#state;
    ds.activeTools = new Map();
    ds.toolInputBuffers = new Map();
    ds.pendingApprovals = new Map();
    ds.pendingSuspensions = new Map();
    ds.activeSubagents = new Map();
    ds.currentMessage = null;
    this.deps.clearFollowUps();
    ds.queuedFollowUps = 0;
    ds.modifiedFiles = new Map();
    ds.tasks = [];
    ds.previousTasks = [];
    ds.omProgress = defaultOMProgressState();
    ds.bufferingMessages = false;
    ds.bufferingObservations = false;
  }

  /**
   * Drop the pending-approval display entries for the given tool calls. Called
   * when a gate is answered (approve/decline) or released (abort / interjection)
   * so the UI stops rendering approvals that can no longer be resolved.
   */
  clearPendingApprovals(toolCallIds: readonly string[]): void {
    for (const toolCallId of toolCallIds) {
      this.#state.pendingApprovals.delete(toolCallId);
    }
  }

  /**
   * Apply a display-state update based on an incoming event. The centralized
   * state machine that keeps {@link AgentControllerDisplayState} in sync with every
   * event the AgentController emits.
   */
  apply(event: AgentControllerEvent): void {
    const ds = this.#state;

    switch (event.type) {
      // ── Agent lifecycle ────────────────────────────────────────────────
      case 'agent_start':
        ds.isRunning = true;
        ds.activeTools = new Map();
        ds.toolInputBuffers = new Map();
        ds.currentMessage = null;
        // Parked approvals are deliberately NOT cleared here either: a run on
        // another thread may still be waiting on one, and resuming a parked tool
        // restarts the run (a fresh agent_start) whose own gate must stay armed
        // until it is answered. Entries drop when a gate is answered or released.
        // Parked tool suspensions are intentionally NOT cleared here: resuming
        // one parked tool restarts the run (a fresh agent_start) and the other
        // parallel prompts must stay rendered until they are resolved.
        break;

      case 'agent_end':
        ds.isRunning = false;
        // A suspended run keeps its pending tool suspensions alive so the UI can
        // still render the prompts (e.g. `ask_user`, which pauses via the native
        // tool-suspension primitive). When the run ends for any other reason the
        // parked suspensions are abandoned, so clear them all.
        if (event.reason !== 'suspended') {
          ds.pendingSuspensions.clear();
        }
        // Mark any still-running tools as errored (handles abort mid-run)
        for (const [, tool] of ds.activeTools) {
          if (tool.status === 'running' || tool.status === 'streaming_input') {
            tool.status = 'error';
          }
        }
        ds.activeSubagents = new Map();
        break;

      // ── Message streaming ──────────────────────────────────────────────
      case 'message_start':
        // The run engine keeps the source message mutable while it folds stream
        // chunks. Display state applies compact deltas independently, so isolate
        // text parts once here rather than appending each delta twice.
        ds.currentMessage = {
          ...event.message,
          content: {
            ...event.message.content,
            parts: event.message.content.parts.map(part => (part.type === 'text' ? { ...part } : part)),
          },
        };
        break;

      case 'message_update': {
        if (ds.currentMessage?.id !== event.id) break;

        const parts = [...ds.currentMessage.content.parts];
        if (event.event.type === 'text-delta') {
          const textIndex = parts.findLastIndex(part => part.type === 'text');
          const textPart = parts[textIndex];
          if (textPart?.type === 'text') {
            parts[textIndex] = { ...textPart, text: textPart.text + event.event.delta };
          } else {
            parts.push({ type: 'text', text: event.event.delta });
          }
        } else if (event.event.type === 'reasoning-delta') {
          const reasoningPart = parts[event.event.index];
          if (reasoningPart?.type === 'reasoning') {
            const reasoning = reasoningPart.reasoning + event.event.delta;
            parts[event.event.index] = { ...reasoningPart, reasoning, details: [{ type: 'text', text: reasoning }] };
          }
        } else {
          parts[event.event.index] = structuredClone(event.event.part);
        }

        ds.currentMessage = {
          ...ds.currentMessage,
          content: { ...ds.currentMessage.content, parts },
        };
        break;
      }

      case 'message_end':
        break;

      // ── Tool lifecycle ─────────────────────────────────────────────────
      case 'tool_input_start': {
        ds.toolInputBuffers.set(event.toolCallId, { text: '', toolName: event.toolName });
        const existing = ds.activeTools.get(event.toolCallId);
        if (existing) {
          existing.status = 'streaming_input';
        } else {
          ds.activeTools.set(event.toolCallId, {
            name: event.toolName,
            args: {},
            status: 'streaming_input',
          });
        }
        break;
      }

      case 'tool_input_delta': {
        const buf = ds.toolInputBuffers.get(event.toolCallId);
        if (buf && typeof event.argsTextDelta === 'string') {
          buf.text += event.argsTextDelta;
        }
        break;
      }

      case 'tool_input_end':
        ds.toolInputBuffers.delete(event.toolCallId);
        break;

      case 'tool_start': {
        const existingTool = ds.activeTools.get(event.toolCallId);
        if (existingTool) {
          existingTool.name = event.toolName;
          existingTool.args = event.args;
          existingTool.status = 'running';
        } else {
          ds.activeTools.set(event.toolCallId, {
            name: event.toolName,
            args: event.args,
            status: 'running',
          });
        }
        break;
      }

      case 'tool_update': {
        const tool = ds.activeTools.get(event.toolCallId);
        if (tool) {
          tool.partialResult =
            typeof event.partialResult === 'string' ? event.partialResult : safeStringify(event.partialResult);
        }
        break;
      }

      case 'tool_end': {
        const endedTool = ds.activeTools.get(event.toolCallId);
        if (endedTool) {
          endedTool.status = event.isError ? 'error' : 'completed';
          endedTool.result = event.result;
          endedTool.isError = event.isError;
        }
        // Track file modifications
        if (!event.isError) {
          const FILE_TOOLS = ['string_replace_lsp', 'write_file', 'ast_smart_edit'];
          const toolState = ds.activeTools.get(event.toolCallId);
          if (toolState && FILE_TOOLS.includes(toolState.name)) {
            const toolArgs = toolState.args as Record<string, unknown>;
            const filePath = toolArgs?.path as string;
            if (filePath) {
              const existing = ds.modifiedFiles.get(filePath);
              if (existing) {
                existing.operations.push(toolState.name);
              } else {
                ds.modifiedFiles.set(filePath, {
                  operations: [toolState.name],
                  firstModified: new Date(),
                });
              }
            }
          }
        }
        // A finished call can no longer be awaiting approval.
        ds.pendingApprovals.delete(event.toolCallId);
        break;
      }

      case 'shell_output': {
        const shellTool = ds.activeTools.get(event.toolCallId);
        if (shellTool) {
          shellTool.shellOutput = (shellTool.shellOutput ?? '') + event.output;
        }
        break;
      }

      case 'tool_approval_required':
        // Keyed by toolCallId and tagged with the producing thread so a gate
        // parked on one thread can never shadow another thread's in the display
        // state. The entry is dropped when the gate is answered or released.
        ds.pendingApprovals.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          threadId: event.threadId,
        });
        break;

      case 'tool_suspended':
        this.#setPendingSuspension({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          suspendPayload: event.suspendPayload,
          resumeSchema: event.resumeSchema,
          resourceId: event.resourceId,
          threadId: event.threadId,
          runId: event.runId,
        });
        break;

      case 'tool_suspension_cancelled':
        if (event.resourceId && event.threadId && event.runId) {
          this.deletePendingSuspension({
            resourceId: event.resourceId,
            threadId: event.threadId,
            runId: event.runId,
            toolCallId: event.toolCallId,
          });
        } else {
          ds.pendingSuspensions.delete(event.toolCallId);
        }
        break;

      // ── Subagent tracking ──────────────────────────────────────────────
      case 'subagent_start': {
        const displayName = this.deps.getSubagentDisplayName(event.agentType);
        ds.activeSubagents.set(event.toolCallId, {
          agentType: event.agentType,
          ...(displayName !== undefined ? { displayName } : {}),
          task: event.task,
          modelId: event.modelId,
          forked: event.forked,
          toolCalls: [],
          textDelta: '',
          status: 'running',
          startedAt: Date.now(),
        });
        break;
      }

      case 'subagent_text_delta': {
        const sub = ds.activeSubagents.get(event.toolCallId);
        if (sub) {
          sub.textDelta += event.textDelta;
        }
        break;
      }

      case 'subagent_tool_start': {
        const subAgent = ds.activeSubagents.get(event.toolCallId);
        if (subAgent) {
          subAgent.toolCalls.push({ name: event.subToolName, isError: false });
        }
        break;
      }

      case 'subagent_tool_end': {
        const subTool = ds.activeSubagents.get(event.toolCallId);
        if (subTool) {
          const tc = subTool.toolCalls.find(t => t.name === event.subToolName && !t.isError);
          if (tc) {
            tc.isError = event.isError;
          }
        }
        break;
      }

      case 'subagent_end': {
        const endedSub = ds.activeSubagents.get(event.toolCallId);
        if (endedSub) {
          endedSub.status = event.isError ? 'error' : 'completed';
          endedSub.durationMs = event.durationMs;
          endedSub.result = event.result;
        }
        break;
      }

      // ── Observational Memory ───────────────────────────────────────────
      case 'om_status': {
        const w = event.windows;
        ds.omProgress.pendingTokens = w.active.messages.tokens;
        ds.omProgress.threshold = w.active.messages.threshold;
        ds.omProgress.thresholdPercent =
          w.active.messages.threshold > 0 ? (w.active.messages.tokens / w.active.messages.threshold) * 100 : 0;
        ds.omProgress.observationTokens = w.active.observations.tokens;
        ds.omProgress.reflectionThreshold = w.active.observations.threshold;
        ds.omProgress.reflectionThresholdPercent =
          w.active.observations.threshold > 0
            ? (w.active.observations.tokens / w.active.observations.threshold) * 100
            : 0;
        ds.omProgress.buffered = {
          observations: { ...w.buffered.observations },
          reflection: { ...w.buffered.reflection },
        };
        ds.omProgress.generationCount = event.generationCount;
        ds.omProgress.stepNumber = event.stepNumber;
        // Drive buffering animation flags from status fields
        ds.bufferingMessages = w.buffered.observations.status === 'running';
        ds.bufferingObservations = w.buffered.reflection.status === 'running';
        break;
      }

      case 'om_observation_start':
        ds.omProgress.status = 'observing';
        ds.omProgress.cycleId = event.cycleId;
        ds.omProgress.startTime = Date.now();
        break;

      case 'om_observation_end':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        ds.omProgress.observationTokens = event.observationTokens;
        // Messages have been observed — reset pending tokens
        ds.omProgress.pendingTokens = 0;
        ds.omProgress.thresholdPercent = 0;
        break;

      case 'om_observation_failed':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        break;

      case 'om_reflection_start':
        ds.omProgress.status = 'reflecting';
        ds.omProgress.cycleId = event.cycleId;
        ds.omProgress.startTime = Date.now();
        ds.omProgress.preReflectionTokens = ds.omProgress.observationTokens;
        ds.omProgress.observationTokens = event.tokensToReflect;
        ds.omProgress.reflectionThresholdPercent =
          ds.omProgress.reflectionThreshold > 0 ? (event.tokensToReflect / ds.omProgress.reflectionThreshold) * 100 : 0;
        break;

      case 'om_reflection_end':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        ds.omProgress.observationTokens = event.compressedTokens;
        ds.omProgress.reflectionThresholdPercent =
          ds.omProgress.reflectionThreshold > 0
            ? (event.compressedTokens / ds.omProgress.reflectionThreshold) * 100
            : 0;
        break;

      case 'om_reflection_failed':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        break;

      case 'om_buffering_start':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = true;
        } else {
          ds.bufferingObservations = true;
        }
        break;

      case 'om_buffering_end':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      case 'om_buffering_failed':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      case 'om_activation':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      // ── Token usage ────────────────────────────────────────────────────
      case 'usage_update':
        ds.tokenUsage = this.deps.getTokenUsage();
        break;

      // ── Tasks ──────────────────────────────────────────────────────────
      case 'task_updated':
        ds.previousTasks = [...ds.tasks];
        ds.tasks = event.tasks;
        break;

      // ── Follow-up queue ────────────────────────────────────────────────
      case 'follow_up_queued':
        ds.queuedFollowUps = event.count;
        break;

      // ── Thread lifecycle ───────────────────────────────────────────────
      case 'thread_changed':
        this.resetThread();
        ds.tokenUsage = this.deps.getTokenUsage();
        break;

      case 'thread_created':
        this.resetThread();
        ds.tokenUsage = createEmptyTokenUsage();
        break;

      case 'thread_deleted':
        if (!this.deps.getThreadId()) {
          this.resetThread();
          ds.tokenUsage = createEmptyTokenUsage();
        }
        break;

      // ── State changes (for OM threshold overrides) ──────────────────────
      case 'state_changed': {
        const keys = event.changedKeys;
        if (keys.includes('observationThreshold')) {
          const value = (event.state as Record<string, unknown>).observationThreshold;
          if (typeof value === 'number') {
            ds.omProgress.threshold = value;
            ds.omProgress.thresholdPercent = value > 0 ? (ds.omProgress.pendingTokens / value) * 100 : 0;
          }
        }
        if (keys.includes('reflectionThreshold')) {
          const value = (event.state as Record<string, unknown>).reflectionThreshold;
          if (typeof value === 'number') {
            ds.omProgress.reflectionThreshold = value;
            ds.omProgress.reflectionThresholdPercent = value > 0 ? (ds.omProgress.observationTokens / value) * 100 : 0;
          }
        }
        break;
      }

      default:
        break;
    }
  }
}

/**
 * A session's event bus. Owns the listener list and the full emit pipeline:
 * fold the event into the canonical display state, dispatch to this session's
 * listeners, then fan out a synthetic `display_state_changed`. Each session
 * has its own bus, so events never cross between sessions. Subsystems hold a
 * reference to their session's bus and call {@link emit} directly.
 */
/**
 * Event types emitted once per streamed chunk. Their display-state snapshots are
 * coalesced, since a snapshot always carries the full state and intermediate
 * ones are immediately superseded.
 */
const COALESCIBLE_DISPLAY_STATE_EVENTS = new Set<AgentControllerEvent['type']>(['message_update', 'tool_input_delta']);

/** Upper bound on coalesced display-state snapshots: one per this many ms, plus a leading one. */
const DISPLAY_STATE_COALESCE_MS = 16;

export class SessionBus {
  readonly #listeners: AgentControllerEventListener[] = [];
  #displayState: SessionDisplayState | undefined;
  /** Timer for the trailing snapshot of the current coalescing window. */
  #displayStateTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether a snapshot was withheld during the current window and still owes a dispatch. */
  #displayStatePending = false;
  /**
   * The last workspace lifecycle event group emitted on this bus, replayed to
   * subscribers that attach after the status changed so they receive the current
   * workspace ready or error state.
   */
  #lastWorkspaceEvents: AgentControllerEvent[] = [];

  /** Attach the display-state reducer the bus folds events into. Set once by the Session. */
  setDisplayState(displayState: SessionDisplayState): void {
    this.#displayState = displayState;
  }

  subscribe(listener: AgentControllerEventListener): () => void {
    // Replay buffered workspace lifecycle events so late subscribers learn the
    // current workspace status regardless of when initialization occurs.
    for (const event of this.#lastWorkspaceEvents) {
      try {
        const result = listener(event);
        if (result && typeof result === 'object' && 'catch' in result) {
          (result as Promise<void>).catch(err => console.error('Error in session event listener:', err));
        }
      } catch (err) {
        console.error('Error in session event listener:', err);
      }
    }
    this.#listeners.push(listener);
    return () => {
      const index = this.#listeners.indexOf(listener);
      if (index !== -1) {
        this.#listeners.splice(index, 1);
      }
    };
  }

  /** Whether anything is currently listening. Lets emitters skip snapshot work nobody reads. */
  hasListeners(): boolean {
    return this.#listeners.length > 0;
  }

  emit(event: AgentControllerEvent): void {
    if (
      event.type === 'workspace_status_changed' ||
      event.type === 'workspace_ready' ||
      event.type === 'workspace_error'
    ) {
      if (event.type === 'workspace_status_changed') {
        this.#lastWorkspaceEvents = [event];
      } else {
        this.#lastWorkspaceEvents.push(event);
      }
    }
    this.#displayState?.apply(event);

    // A pending snapshot describes state that predates this event, so it must
    // reach listeners before the event itself does. Flushing here also means a
    // coalesced snapshot can never arrive after the event that superseded it.
    if (!COALESCIBLE_DISPLAY_STATE_EVENTS.has(event.type)) {
      this.#flushDisplayState();
    }

    this.#dispatch(event);

    if (event.type === 'display_state_changed' || !this.#displayState) return;

    if (COALESCIBLE_DISPLAY_STATE_EVENTS.has(event.type)) {
      this.#scheduleDisplayState();
      return;
    }
    this.#dispatch({ type: 'display_state_changed', displayState: this.#displayState.get() });
  }

  /**
   * Queue a display-state snapshot for a high-frequency event. Streaming a
   * single message emits thousands of deltas, and dispatching a full snapshot
   * per delta re-serializes the whole message (plus every completed tool's args
   * and result) on each one. Snapshots are state-of-the-world rather than
   * incremental, so dropping intermediate ones loses nothing: the trailing
   * flush carries the latest state.
   *
   * The first delta of a burst dispatches immediately so UIs stay responsive;
   * the rest collapse into one trailing snapshot per interval.
   */
  #scheduleDisplayState(): void {
    if (this.#displayStateTimer) {
      this.#displayStatePending = true;
      return;
    }
    this.#dispatch({ type: 'display_state_changed', displayState: this.#displayState!.get() });
    this.#displayStateTimer = setTimeout(() => {
      this.#displayStateTimer = undefined;
      this.#flushDisplayState();
    }, DISPLAY_STATE_COALESCE_MS);
    // Never hold the process open for a snapshot that only mirrors state.
    (this.#displayStateTimer as { unref?: () => void }).unref?.();
  }

  /** Dispatch any snapshot withheld by coalescing and clear the pending timer. */
  #flushDisplayState(): void {
    if (this.#displayStateTimer) {
      clearTimeout(this.#displayStateTimer);
      this.#displayStateTimer = undefined;
    }
    if (!this.#displayStatePending) return;
    this.#displayStatePending = false;
    if (this.#displayState) {
      this.#dispatch({ type: 'display_state_changed', displayState: this.#displayState.get() });
    }
  }

  #dispatch(event: AgentControllerEvent): void {
    for (const listener of [...this.#listeners]) {
      try {
        const result = listener(event);
        if (result && typeof result === 'object' && 'catch' in result) {
          (result as Promise<void>).catch(err => console.error('Error in session event listener:', err));
        }
      } catch (err) {
        console.error('Error in session event listener:', err);
      }
    }
  }
}

/**
 * A process-local host for `{ id, resourceId, scope, tags, active threadId }`.
 * It is not the durable conversation record: mode, model, persisted state,
 * token usage, pending runs, and display projections are re-derived from the
 * active thread whenever one is created or selected. Custom `TState` fields
 * that are not reserved thread settings are host-level configuration.
 */
export class Session<TState = unknown> {
  /** Every cancellation intent invalidates pending startup, even when teardown is already in progress. */
  #abortGeneration = 0;
  /** This session's event bus. Constructed first so every subsystem can route its events here. */
  readonly #bus = new SessionBus();
  /** Process-local hooks that must finish before the session exposes a terminal agent event. */
  readonly #beforeAgentEndListeners = new Set<SessionBeforeAgentEndListener>();
  /** Tool categories granted "allow", bucketed by thread id (or the session-wide bucket). */
  readonly #grantedCategories = new Map<string, Set<string>>();
  /** Individual tool names granted "allow", bucketed by thread id (or the session-wide bucket). */
  readonly #grantedTools = new Map<string, Set<string>>();
  /** Running token-usage tally for the active thread. */
  #tokenUsage: TokenUsage = createEmptyTokenUsage();
  /** Whether the in-flight abort teardown must stay local to this process. */
  #localOnlyAbort = false;
  #deferredAbortOrigin: { bindingGeneration: number; localOnly: boolean } | undefined;
  /** Thread-settings persistence handle, injected by the AgentController via {@link setStore}. */
  #store: ThreadSettingsStore | undefined;
  /** Resolves a tool name to its category, injected by the AgentController via {@link setCategoryResolver} (the category map is AgentController config). */
  #resolveCategory: ((toolName: string) => ToolCategory | null) | undefined;
  /** Resolves a subagent's display name from AgentController config, injected via {@link setSubagentNameResolver}. */
  #resolveSubagentName: ((agentType: string) => string | undefined) | undefined;
  /** AgentController-owned run machinery (agent, run/stream option builders, …), injected via {@link setMachinery}. */
  #machinery: SessionMachinery | undefined;
  /** The per-session agent run engine, constructed once machinery is wired via {@link setMachinery}. */
  #engine: SessionRunEngine | undefined;
  /** The session's currently-selected model (source of truth). */
  readonly model: SessionModel;
  /** The session's currently-selected mode. */
  readonly mode = new SessionMode(() => this.#store, this.#bus);
  /** The session's observational-memory model selection (observer/reflector). */
  readonly om = new SessionOM(this.#bus);
  /** The session's persisted tool-permission rules (per-category / per-tool). */
  readonly permissions = new SessionPermissions();
  /** The session's subagent configuration (currently the subagent model). */
  readonly subagents = new SessionSubagents(this.#bus);
  /** Transient run identity (run id, trace id, operation counter) for the active run. */
  readonly run = new SessionRun();
  /** Live subscription to the active thread's agent event stream. */
  readonly stream = new SessionStream(() => ({
    sessionId: this.identity.getId(),
    runId: this.run.getRunId(),
  }));
  /** Rebuildable resume mirror for suspensions on the active thread. */
  readonly suspensions: SessionSuspensions;
  /** Captured Agent queue scope for this session binding. */
  #followUpBinding?: { agent: Agent; resourceId: string; threadId: string; unsubscribe?: () => void };
  /** Follow-up preparation that can finish after the session's active run changes. */
  readonly #preparingFollowUps = new Set<{ generation: number; controller: AbortController }>();
  /** Invalidates asynchronous follow-up preparation when the session unbinds. */
  #followUpGeneration = 0;
  /** The interactive tool-approval gate the current run parks on. */
  readonly approval = new SessionApproval();
  /** The session's identity: the memory resourceId it reads/writes under. */
  readonly identity: SessionIdentity;
  /** The session's thread domain: current binding + reads scoped to it. */
  readonly thread: SessionThread;
  /** The canonical display state a UI renders, plus the reducer that maintains it. */
  readonly displayState: SessionDisplayState;
  /** The session-owned AgentController state domain. */
  readonly state: AgentControllerRequestState<TState> & Pick<SessionState<TState>, 'setIf'>;
  /**
   * Scoping tags for this session (e.g. `{ projectPath }`). Seeded at creation
   * and stamped onto every thread this session creates so thread listings can be
   * filtered back to the session's scope. Empty when the session is unscoped.
   */
  readonly #tags: Record<string, string>;
  readonly #workspace: Workspace | undefined;
  browser?: MastraBrowser;

  constructor({
    resourceId,
    state,
    id,
    ownerId,
    tags,
    workspace,
    browser,
  }: {
    resourceId: string;
    state?: SessionStateOptions<TState>;
    id: string;
    ownerId: string;
    tags?: Record<string, string>;
    workspace?: Workspace;
    browser?: MastraBrowser;
  }) {
    this.#tags = tags && Object.keys(tags).length > 0 ? { ...tags } : {};
    this.identity = new SessionIdentity({ resourceId, id, ownerId });
    this.thread = new SessionThread(() => this.identity.getResourceId());
    this.suspensions = new SessionSuspensions(() => ({
      resourceId: this.identity.getResourceId(),
      threadId: this.thread.getId(),
    }));
    this.displayState = new SessionDisplayState({
      getTokenUsage: () => this.getTokenUsage(),
      getSubagentDisplayName: agentType => this.#resolveSubagentName?.(agentType),
      getThreadId: () => this.thread.getId(),
      clearFollowUps: () => this.cleanupFollowUpBinding(),
    });
    this.#bus.setDisplayState(this.displayState);
    const sessionState = new SessionState(
      state ?? { initialState: {} as TState },
      this.#bus,
      () => {
        const threadId = this.thread.getId();
        if (threadId === null) return undefined;
        return args => this.thread.setSettingOn({ threadId, ...args });
      },
      () => ({ resourceId: this.identity.getResourceId(), threadId: this.thread.getId() }),
      () => ({ modeId: this.mode.get(), modelId: this.model.get() }),
    );
    this.state = sessionState;
    this.model = new SessionModel(
      () => this.#store,
      this.#bus,
      (level, commit, isActive, applyModel) =>
        sessionState.setWithCommit(
          { thinkingLevel: level } as unknown as Partial<TState>,
          commit,
          isActive,
          applyModel,
        ),
      () => {
        const state = sessionState.get();
        const level = state && typeof state === 'object' && 'thinkingLevel' in state ? state.thinkingLevel : undefined;
        switch (level) {
          case 'off':
          case 'low':
          case 'medium':
          case 'high':
          case 'xhigh':
          case 'max':
            return level;
          default:
            return undefined;
        }
      },
    );

    if (workspace !== undefined && !(workspace instanceof Workspace)) {
      throw new Error(`A session workspace must be a valid Workspace instance.`);
    }

    this.#workspace = workspace;
    this.browser = browser;
  }

  /**
   * This session's scoping tags (e.g. `{ projectPath }`), stamped onto every
   * thread it creates. Returns a copy; empty when the session is unscoped.
   */
  getTags(): Record<string, string> {
    return { ...this.#tags };
  }

  /** @internal Restore host defaults before hydrating another thread's selection. */
  resetThreadSelection(): void {
    (this.state as SessionState<TState>).captureSelection();
    this.mode.reset();
    this.model.reset();
  }

  /** @internal Reset state fields whose durable source is the active thread. */
  resetThreadDerivedState(): void {
    (this.state as SessionState<TState>).rebind(THREAD_DERIVED_STATE_KEYS);
  }

  /**
   * The scope this session's threads carry: what `thread.create()` stamps and
   * what thread selection filters on. Both must read it here — computing it on
   * each side is what let selection drift off the controller-global state while
   * creation stamped the session's own.
   */
  getThreadScope(): Record<string, string> {
    const tags = Object.fromEntries(Object.entries(this.#tags).filter(([key]) => !isReservedThreadMetadataKey(key)));
    if (Object.keys(tags).length > 0) return tags;
    const { projectPath } = this.state.get() as { projectPath?: string };
    return projectPath ? { projectPath } : {};
  }

  /**
   * The workspace resolved for this session, or `undefined` when the session
   * runs without one. A workspace is optional: sessions that only need threads,
   * state, and agent runs (chat-style usage) do not have to configure
   * filesystem or sandbox access.
   *
   * Dynamic workspace factories are evaluated independently when each session
   * is created. Use this accessor for operations that must stay bound to the
   * session's workspace rather than resolving through controller-global state.
   */
  getWorkspace(): Workspace | undefined {
    return this.#workspace;
  }

  // ===========================================================================
  // Event bus
  // ===========================================================================

  /**
   * Subscribe to this session's events. Returns an unsubscribe function.
   * Listeners are scoped to this session: a session never delivers its events
   * to another session's subscribers.
   */
  subscribe(listener: AgentControllerEventListener): () => void {
    return this.#bus.subscribe(listener);
  }

  /** Subscribe to work that must complete before the terminal agent event is exposed. */
  onBeforeAgentEnd(listener: SessionBeforeAgentEndListener): () => void {
    this.#beforeAgentEndListeners.add(listener);
    return () => this.#beforeAgentEndListeners.delete(listener);
  }

  /** Await terminal hooks, then emit the terminal event to subscribers. */
  async finishAgentRun(
    reason: NonNullable<Extract<AgentControllerEvent, { type: 'agent_end' }>['reason']>,
  ): Promise<void> {
    const event = { type: 'agent_end', reason } as const;
    for (const listener of this.#beforeAgentEndListeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error('Error in before-agent-end listener:', error);
      }
    }
    this.emit(event);
  }

  /** Await the terminal event for a specific accepted agent run. */
  private async waitForAcceptedRunCompletion<OUTPUT>(
    accepted: Promise<{ action?: SendAgentSignalAccepted<OUTPUT>['action']; runId?: string }>,
    { waitForDelivery = true }: { waitForDelivery?: boolean } = {},
  ): Promise<void> {
    const completedRunIds = new Set<string>();
    let runId: string | undefined;
    let resolveCompletion!: () => void;
    const completion = new Promise<void>(resolve => {
      resolveCompletion = resolve;
    });
    const unsubscribe = this.onBeforeAgentEnd(() => {
      const endingRunId = this.run.getRunId();
      if (!endingRunId) return;
      completedRunIds.add(endingRunId);
      if (endingRunId === runId) resolveCompletion();
    });
    // `agent_end` must not be the only way out: stop waiting when the run loop
    // fails, the subscription is torn down, or the run is aborted, otherwise a
    // missed event (e.g. concurrent runs on one thread) hangs the caller forever.
    const waitersController = new AbortController();
    // Register before awaiting acceptance so a teardown while it is pending is not missed.
    const threadId = this.thread.getId();
    let tornDown = false;
    const teardown = this.stream.waitForTeardown(waitersController.signal).then(() => {
      tornDown = true;
    });
    // Likewise for aborts: one already requested is left over from an earlier
    // run and must not release this caller; any requested from here on counts.
    let aborted = false;
    const abortRequest = this.run
      .waitForAbortRequest(waitersController.signal, { after: this.run.getAbortGeneration() })
      .then(() => {
        aborted = true;
      });

    try {
      const result = await accepted;
      if (aborted) return;
      if (result.action !== 'wake' && !waitForDelivery) return;
      runId = 'runId' in result ? result.runId : undefined;
      if (!runId || completedRunIds.has(runId)) return;
      // A teardown during acceptance ends the wait unless the same thread was
      // re-attached (sending may rebind the subscription on its own). An unbound
      // session adopts whichever thread acceptance created for it.
      if (tornDown && (!this.stream.isOpen() || (threadId !== null && this.thread.getId() !== threadId))) return;
      const waits: Promise<unknown>[] = [
        completion,
        this.stream.waitForConsumerFailure(waitersController.signal),
        tornDown ? this.stream.waitForTeardown(waitersController.signal) : teardown,
        abortRequest,
      ];
      await Promise.race(waits);
    } finally {
      waitersController.abort();
      unsubscribe();
    }
  }

  /**
   * Emit an event on this session. Delegates to this session's bus, which folds
   * the event into the canonical display state, dispatches to this session's
   * listeners, then fans out a synthetic `display_state_changed`.
   */
  emit(event: AgentControllerEvent): void {
    this.#bus.emit(event);
  }

  /**
   * Whether this session has any event subscribers. Emitters use this to skip
   * building per-event snapshots that nothing would read.
   */
  hasListeners(): boolean {
    return this.#bus.hasListeners();
  }

  /**
   * Attach the thread-settings store the Session persists mode/model through.
   * The AgentController calls this once storage is available; without it, mode/model
   * state lives purely in memory.
   */
  setStore(store: ThreadSettingsStore | undefined): void {
    this.#store = store;
  }

  /**
   * Attach the tool→category resolver used when a user picks "always allow
   * category". The category map is AgentController config, so the AgentController injects this
   * once; without it, an "always_allow_category" decision simply approves.
   */
  setCategoryResolver(resolveCategory: (toolName: string) => ToolCategory | null): void {
    this.#resolveCategory = resolveCategory;
  }

  /**
   * Attach the subagent display-name resolver the display-state reducer uses to
   * label active subagents. The subagent catalog is AgentController config, so the
   * AgentController injects this once; without it, subagents render without a name.
   */
  setSubagentNameResolver(resolveSubagentName: (agentType: string) => string | undefined): void {
    this.#resolveSubagentName = resolveSubagentName;
  }

  /**
   * Attach the AgentController-owned run machinery this session leverages to drive agent
   * runs (resolve the agent, build run/stream options + toolsets + request
   * context, persist usage, generate ids). The AgentController injects this once when it
   * constructs the session. The run loop, run state, and thread stream live on
   * the session; this is the narrow set of shared capabilities it reaches back
   * into the host for — see {@link SessionMachinery}.
   */
  setMachinery(machinery: SessionMachinery): void {
    this.#machinery = machinery;
    this.#engine = new SessionRunEngine(this as Session, machinery);
  }

  /**
   * The AgentController-owned run machinery injected via {@link setMachinery}, throwing
   * when accessed before wiring (a run can never be driven without it).
   */
  get machinery(): SessionMachinery {
    if (!this.#machinery) {
      throw new Error('Session run machinery has not been wired by the AgentController');
    }
    return this.#machinery;
  }

  /** The per-session run engine, throwing when accessed before machinery is wired. */
  get runEngine(): SessionRunEngine {
    if (!this.#engine) {
      throw new Error('Session run engine has not been wired by the AgentController');
    }
    return this.#engine;
  }

  /**
   * Consume an agent stream response, folding chunks into this session's display
   * messages and usage and driving tool approval. Delegates to the per-session
   * run engine. Production runs go through `processSubscribedThreadStream`;
   * only tests call this directly.
   */
  processStream(
    response: { fullStream: AsyncIterable<any> },
    requestContext?: RequestContext,
  ): Promise<{ message: MastraDBMessage; suspended?: boolean } | undefined> {
    return this.runEngine.processStream(response, requestContext);
  }

  /**
   * Drive the run loop for a subscribed thread stream: process each run's chunks
   * and finalize it. Delegates to the per-session run engine.
   */
  processSubscribedThreadStream(subscription: AgentThreadSubscription<any, true>): Promise<void> {
    return this.runEngine.processSubscribedThreadStream(subscription);
  }

  /**
   * The id of the run currently active on this session: the live subscription's
   * active run id when it is streaming, falling back to the last run id the run
   * tracker observed. Null when the session is idle.
   */
  getCurrentRunId(): string | null {
    return this.stream.activeRunId() ?? this.run.getRunId();
  }

  /**
   * Abort the session's active run: drop any parked tool suspensions, abort the
   * live subscription's in-flight run, and mark the run as aborting so the
   * run-end path resolves its reason as 'aborted'.
   *
   * Dropping the parked suspensions matters because a run sitting in a tool
   * `suspend()` (e.g. `ask_user` / `request_access`) is not actively streaming,
   * so aborting the controller alone would leave it orphaned. The AgentController still
   * clears its own display-state mirror of those suspensions separately.
   *
   * Releasing a parked tool-approval gate matters for the same reason: a run
   * awaiting `approval.arm()` is not streaming, so we resolve it as a decline so
   * the gated tool is rejected and the run can finalize rather than hang.
   */
  abortRun(options: { localOnly?: boolean } = {}): void {
    this.#abortGeneration++;
    // Aborting twice while a gate is parked would tear the stream down before
    // the deferred decline lands (the second call sees the gate already
    // cancelled), which is the exact failure the deferral exists to avoid. Two
    // `tool_approval_required` subscribers each calling abort() is enough.
    if (this.run.isAbortRequested()) return;

    // Retract the prompts for every parked suspension. Dropping them silently
    // left the UI rendering `ask_user` / `request_access` prompts whose answers
    // could never land, since the run they belong to is gone.
    const suspendedToolCalls = this.suspensions.clear();
    for (const suspension of suspendedToolCalls) {
      this.emit({
        type: 'tool_suspension_cancelled',
        resourceId: suspension.resourceId,
        threadId: suspension.threadId,
        runId: suspension.runId,
        toolCallId: suspension.toolCallId,
        toolName: suspension.toolName,
        reason: ABORTED_BY_USER_REASON,
      });
    }

    // The teardown may be deferred (below), so remember whether this abort should
    // stay local for when it actually runs.
    this.#localOnlyAbort = options.localOnly === true;

    // A parked approval gate is special: the agent-side run is still alive and
    // waiting for the decision, so the gated call must be declined through it
    // (that is what persists the `output-denied` tool result). Tearing the
    // stream down first would make that decline fail with "could not find an
    // active or suspended run". Defer both the stream abort and the abort
    // signal to the engine, which fires them once the decline has landed.
    // Scope the lookup to this thread: a background run on a detached thread can
    // be parked on its own approval, and aborting here must neither decline nor
    // defer the abort for that other thread's gate.
    const abortThreadId = this.thread.getId() ?? undefined;
    const wasGated = this.approval.isArmed({ threadId: abortThreadId });
    if (wasGated) {
      this.run.requestAbort({ deferSignal: true });
      // The engine completes this teardown after its decline await; a rebind can
      // start a successor run in that window, so bind it to this binding too.
      this.#deferredAbortOrigin = { bindingGeneration: this.run.bindingGeneration(), localOnly: this.#localOnlyAbort };
      if (suspendedToolCalls.length === 0) {
        this.#releaseApprovalGates({ threadId: abortThreadId });
        return;
      }
      void this.runEngine
        .settleSuspendedToolCallsAsDenied(suspendedToolCalls)
        .catch(error => this.emit({ type: 'error', error: getErrorFromUnknown(error) }))
        .finally(() => this.#releaseApprovalGates({ threadId: abortThreadId }));
      return;
    }

    if (suspendedToolCalls.length > 0) {
      this.run.requestAbort({ deferSignal: true });
      // Settlement is async; a thread switch / `/new` can tear down the binding
      // and start a successor run before it lands. Bind the teardown to this
      // binding and abort mode so it cannot abort that successor.
      const origin = { bindingGeneration: this.run.bindingGeneration(), localOnly: this.#localOnlyAbort };
      void this.runEngine
        .settleSuspendedToolCallsAsDenied(suspendedToolCalls)
        .catch(error => this.emit({ type: 'error', error: getErrorFromUnknown(error) }))
        .finally(() => this.completeDeferredAbort(origin));
      return;
    }

    this.stream.abort({ localOnly: this.#localOnlyAbort });
    this.run.requestAbort();
  }

  /**
   * Take the origin captured when a gated abort was armed. The run engine
   * claims it as soon as the gate releases, so a later abort of another run
   * cannot overwrite the origin this run's teardown is checked against.
   */
  takeDeferredAbortOrigin(): { bindingGeneration: number; localOnly: boolean } | undefined {
    const origin = this.#deferredAbortOrigin;
    this.#deferredAbortOrigin = undefined;
    return origin;
  }

  /**
   * Fire the deferred abort teardown for a run that was aborted while parked on
   * a tool-approval gate: abort the live subscription and the run's controller.
   * Called by the run engine once the gated call's decline has been driven
   * through the agent, so the denial is persisted before the run is torn down.
   * When `origin` is present, the teardown is skipped if the session's binding
   * was torn down since, because a successor run may now own the stream and
   * run state. (The abort-requested flag is not a usable guard: the denial's
   * own resumed run resets it before settlement resolves.)
   */
  completeDeferredAbort(origin?: { bindingGeneration: number; localOnly: boolean }): void {
    if (origin && this.run.bindingGeneration() !== origin.bindingGeneration) return;
    this.stream.abort({ localOnly: origin?.localOnly ?? this.#localOnlyAbort });
    this.run.requestAbort();
  }

  /**
   * Abort the session's active run and clear the display-state mirror of any
   * parked tool suspensions. {@link abortRun} drops the parked suspensions (so a
   * run sitting in a tool suspend() like ask_user / request_access isn't left
   * orphaned), aborts the live subscription, and marks the run as aborting; this
   * additionally clears the display-state mirror of those suspensions and
   * notifies subscribers so stale suspension UI doesn't linger.
   */
  abort(options: { localOnly?: boolean } = {}): void {
    const hadPendingSuspensions = this.displayState.get().pendingSuspensions.size > 0;
    this.displayState.clearPendingSuspensions();
    this.abortRun(options);
    // Clearing the suspension mirror is a direct mutation, so it doesn't flow
    // through the display-state reducer. Notify subscribers explicitly when we
    // actually removed something, otherwise stale suspension UI can linger.
    if (hadPendingSuspensions) {
      this.emit({ type: 'display_state_changed', displayState: this.displayState.get() });
    }
  }

  /**
   * Resolve the effective approval policy for a tool: explicit per-tool deny
   * wins, then session-wide yolo, then an explicit per-tool policy, then a
   * grant, then the tool's category grant/policy, falling back to "ask". Pure
   * session state plus the injected category resolver.
   *
   * Grants are checked against `threadId` (default: the current thread) plus the
   * session-wide bucket, so a grant made from one thread's approval prompt is
   * not inherited by every other thread in the session.
   */
  resolveToolApproval(toolName: string, threadId?: string): PermissionPolicy {
    const state = this.state.get() as Record<string, unknown>;
    const rules = this.permissions.getRules();

    const toolPolicy = rules.tools[toolName];
    if (toolPolicy === 'deny') return 'deny';

    if (state.yolo === true) return 'allow';

    if (toolPolicy) return toolPolicy;

    if (this.hasToolGrant(toolName, threadId)) return 'allow';

    const category = this.#resolveCategory?.(toolName);
    if (category) {
      if (this.hasCategoryGrant(category, threadId)) return 'allow';
      const categoryPolicy = rules.categories[category];
      if (categoryPolicy) return categoryPolicy;
    }

    return 'ask';
  }

  /**
   * Respond to the parked tool-approval gate named by `toolCallId` with the
   * user's decision. The id is required: a response can only release the gate it
   * names, so a stale or id-less response can never resolve a different pending
   * gate. A no-op when that gate is not parked, or when the run is aborting and
   * the gate belongs to the aborting thread.
   * "always_allow_category" grants the gated tool's category to the thread that
   * owns the gate (resolved via the injected {@link setCategoryResolver}) and then
   * approves; "approve"/"decline" release the run as-is.
   */
  respondToToolApproval({
    decision,
    toolCallId,
    requestContext,
    declineContext,
  }: {
    decision: 'approve' | 'decline' | 'always_allow_category';
    toolCallId: string;
    requestContext?: RequestContext;
    declineContext?: { reason?: string; message?: string };
  }): SessionCommandResult {
    // An abort tears down only this thread's gates, so only a response to one of
    // them is ignored. A gate parked on a detached thread must still accept its
    // own response — the abort flag is session-wide and would otherwise strand
    // that gate permanently.
    if (
      this.run.isAbortRequested() &&
      this.approval.isArmed({ toolCallId, threadId: this.thread.getId() ?? undefined })
    ) {
      return { accepted: false, reason: 'aborting' };
    }
    const result = this.approval.respond({
      decision,
      toolCallId,
      requestContext,
      declineContext,
      onAlwaysAllow: (toolName, threadId) => {
        const category = this.#resolveCategory?.(toolName);
        if (category) this.grantCategory(category, threadId);
      },
    });
    // The gate is gone; drop its display-state entry so the UI stops rendering it.
    this.displayState.clearPendingApprovals([toolCallId]);
    return result;
  }

  /**
   * Decline every parked approval gate matching `filter` and drop the matching
   * display entries. Used to release this thread's gate(s) on abort, or when a
   * user message interrupts a run — never another thread's, so a background
   * run's approval authority stays untouched.
   */
  #releaseApprovalGates(
    filter: {
      toolCallId?: string;
      threadId?: string;
      runId?: string;
      declineContext?: { reason?: string; message?: string };
    } = {},
  ): void {
    this.displayState.clearPendingApprovals(this.approval.cancel(filter));
  }

  /**
   * Whether a suspended run on the current thread is waiting on an approval for
   * `toolCallId`. Lets callers reject stale answers before scheduling the resume.
   */
  async hasPersistedToolApproval(toolCallId: string): Promise<boolean> {
    const threadId = this.thread.getId();
    if (!threadId) return false;
    const resourceId = this.identity.getResourceId();
    const { runs } = await this.machinery.getAgent().listSuspendedRuns({ threadId, resourceId });
    return runs.some(run => run.toolCalls.some(call => call.requiresApproval && call.toolCallId === toolCallId));
  }

  /**
   * Answer an approval that is stored with a suspended run but not parked on this
   * session's gate, e.g. a card rebuilt from thread history after a restart.
   * Resolves the run that owns `toolCallId` and resumes it by run id. Throws when
   * no suspended run on the current thread is waiting on that tool call.
   */
  async respondToPersistedToolApproval({
    toolCallId,
    approved,
    requestContext,
  }: {
    toolCallId: string;
    approved: boolean;
    requestContext?: RequestContext;
  }): Promise<void> {
    const threadId = this.thread.getId();
    const resourceId = this.identity.getResourceId();
    if (!threadId) throw new Error('Cannot answer a tool approval without a current thread');
    const { runs } = await this.machinery.getAgent().listSuspendedRuns({ threadId, resourceId });
    const run = runs.find(candidate =>
      candidate.toolCalls.some(call => call.requiresApproval && call.toolCallId === toolCallId),
    );
    if (!run) throw new Error(`No suspended run is waiting on tool call ${toolCallId}`);
    const identity = { toolCallId, requestContext, runId: run.runId, threadId, resourceId };
    if (approved) await this.approveToolCall(identity);
    else await this.declineToolCall(identity);
  }

  // ===========================================================================
  // Run control
  // ===========================================================================

  /**
   * Build the agent message input for a user turn, attaching any files as
   * additional message parts (text files inlined as fenced code, binary files
   * as `file` parts). Returns the plain string when there are no files.
   */
  private createMessageInput({
    content,
    files,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
  }): AgentSignalContents {
    if (!files?.length) return content;

    const fileParts = files.map(f => {
      const isText = f.mediaType.startsWith('text/') || f.mediaType === 'application/json';
      if (isText) {
        let textContent = f.data;
        const base64Match = f.data.match(/^data:[^;]*;base64,(.*)$/);
        if (base64Match) {
          try {
            textContent = Buffer.from(base64Match[1]!, 'base64').toString('utf-8');
          } catch {
            // Fall through with raw data
          }
        }
        const label = f.filename ? `[File: ${f.filename}]` : '[Attached file]';
        const maxBacktickRun = Math.max(0, ...Array.from(textContent.matchAll(/`+/g), match => match[0].length));
        const fence = '`'.repeat(Math.max(3, maxBacktickRun + 1));
        return { type: 'text' as const, text: `${label}\n${fence}\n${textContent}\n${fence}` };
      }
      return {
        type: 'file' as const,
        data: f.data,
        mediaType: f.mediaType,
        ...(f.filename ? { filename: f.filename } : {}),
      };
    });

    return [{ type: 'text', text: content }, ...fileParts];
  }

  /**
   * Watch for the live subscription's next teardown (detach or cleanup). The run
   * engine detaches an aborted subscription only after that run has ended, so
   * work that must land on a fresh subscription waits for this first. Register
   * it before awaiting anything, while the aborted handle is still attached.
   */
  #watchStreamTeardown(): { wait: (timeoutMs: number) => Promise<void>; cancel: () => void } {
    const watcher = new AbortController();
    const teardown = this.stream.waitForTeardown(watcher.signal);
    return {
      wait: async timeoutMs => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            teardown,
            new Promise<void>(resolve => {
              timer = setTimeout(resolve, timeoutMs);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
          watcher.abort();
        }
      },
      cancel: () => watcher.abort(),
    };
  }

  /**
   * Resolve once this session's stream is fully idle.
   *
   * After `abort()` is called the run's status can still be `'running'` for a
   * few microtasks while the underlying model stream finalizes. Callers that
   * need to send a fresh signal after an abort (e.g. plan approval → mode
   * switch → trigger reminder) should await this before calling `sendSignal`
   * to avoid the new signal being queued onto the dying run, which would then
   * be drained with the previous run's already-aborted abortSignal.
   */
  private async waitForStreamIdle(timeoutMs = 1_000): Promise<boolean> {
    if (!this.stream.isActive() && this.run.getRunId() === null) return true;

    let lifecycleWait: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<'timeout'>(resolve => {
      timeout = setTimeout(() => resolve('timeout'), timeoutMs);
    });

    try {
      while (this.stream.isActive() || this.run.getRunId() !== null) {
        lifecycleWait = new AbortController();
        const result = await Promise.race([
          this.stream.waitForTeardown(lifecycleWait.signal),
          this.run.waitForTeardown(lifecycleWait.signal),
          timeoutPromise,
        ]);
        lifecycleWait.abort();
        lifecycleWait = undefined;
        // Teardown did not complete within the timeout: the old run is still
        // finalizing and its live subscription still matches, so the caller
        // must force a fresh subscription rather than trusting `matches`.
        if (result === 'timeout') return false;
      }
    } finally {
      lifecycleWait?.abort();
      if (timeout) clearTimeout(timeout);
    }
    return true;
  }

  /** Persist a signal to an explicit conversation without changing this session's current thread. */
  sendSignalToThread(
    input: AgentSignalInput,
    target: { resourceId: string; threadId: string },
    options?: { requestContext?: RequestContext },
  ): { id: string; type: AgentSignalInput['type']; accepted: Promise<{ accepted: true }> } {
    const signal = createSignal(input);
    const accepted = Promise.resolve().then(async () => {
      await this.machinery.authorizeExecute?.(options?.requestContext);
      const resourceId = this.identity.getResourceId();
      const thread = target.resourceId === resourceId ? await this.thread.getById({ threadId: target.threadId }) : null;
      if (!thread || thread.resourceId !== resourceId) {
        throw new Error(`Thread not found: ${target.threadId}`);
      }

      const result = this.machinery.getAgent().sendSignal(signal, {
        ...target,
        ifActive: { behavior: 'persist' },
        ifIdle: { behavior: 'persist' },
      });
      const settled = await result.accepted;

      if (settled.action === 'persist') {
        await result.persisted;
        if (this.identity.getResourceId() === target.resourceId && this.thread.getId() === target.threadId) {
          const message = signal.toDBMessage(target);
          this.emit({ type: 'message_start', message });
          this.emit({ type: 'message_end', id: message.id });
        }
      }

      return { accepted: true as const };
    });

    return { id: signal.id, type: signal.type, accepted };
  }

  /**
   * Send a signal to this session's current agent/thread. Creates a thread when
   * the session is not yet bound. When a run is already active the signal is
   * dispatched onto it; otherwise the signal carries fresh stream options that
   * start a new run.
   */
  sendSignal(
    input:
      | AgentSignalInput
      | {
          content: AgentSignalContents;
          ifActive?: { behavior?: AgentSignalActiveBehavior; attributes?: AgentSignalAttributes };
          ifIdle?: { behavior?: AgentSignalIdleBehavior; attributes?: AgentSignalAttributes };
          tracingContext?: TracingContext;
          tracingOptions?: TracingOptions;
          requestContext?: RequestContext;
          untilIdle?: boolean | { maxIdleMs?: number };
          /**
           * Provider options attached to the resulting prompt turn. Surfaces as
           * `providerOptions` on the `UserModelMessage` sent to the model and as
           * `content.providerMetadata` on the persisted DB message (see
           * {@link AgentSignalInput.providerOptions}).
           */
          providerOptions?: MastraProviderMetadata;
        },
    options?: {
      ifActive?: { behavior?: AgentSignalActiveBehavior; attributes?: AgentSignalAttributes };
      ifIdle?: { behavior?: AgentSignalIdleBehavior; attributes?: AgentSignalAttributes };
      tracingContext?: TracingContext;
      tracingOptions?: TracingOptions;
      requestContext?: RequestContext;
      untilIdle?: boolean | { maxIdleMs?: number };
      /**
       * When true, the returned `accepted` promise awaits the agent's real
       * acceptance decision (`wake`/`deliver`/…) and propagates routing or
       * stream-setup failures as rejections instead of resolving on the next
       * tick. Callers that need delivery guarantees (e.g. the Factory rule
       * dispatcher) use this so a failed wake is retried rather than silently
       * treated as sent.
       */
      requireDelivery?: boolean;
    },
  ): {
    id: string;
    type: AgentSignalInput['type'];
    accepted: Promise<{ accepted: true; runId?: string; action?: SendAgentSignalAccepted['action'] }>;
  } {
    const settleRunId = async <T>(result: {
      accepted: Promise<SendAgentSignalAccepted<T>>;
    }): Promise<string | undefined> => {
      // Best-effort run id for telemetry. A wake whose stream setup fails rejects
      // `accepted`; that error surfaces to the controller through the thread subscription
      // as an error event, so we must not let it reject the session send here.
      const settled = await result.accepted.catch(() => undefined);
      return settled && 'runId' in settled ? settled.runId : undefined;
    };
    const submittedAbortGeneration = this.#abortGeneration;
    const assertNotCancelled = () => {
      if (this.#abortGeneration !== submittedAbortGeneration) {
        // A newer signal may already own the session controller. Reject only
        // this obsolete startup, without aborting that newer run.
        throw new SessionStartupCancelledError();
      }
    };
    const contentOptions = 'content' in input ? input : undefined;
    const tracingContext = options?.tracingContext ?? contentOptions?.tracingContext;
    const tracingOptions = options?.tracingOptions ?? contentOptions?.tracingOptions;
    const requestContextInput = options?.requestContext ?? contentOptions?.requestContext;
    const untilIdle = options?.untilIdle ?? contentOptions?.untilIdle;
    const requireDelivery = options?.requireDelivery ?? false;
    const ifActive = options?.ifActive ?? ('content' in input ? input.ifActive : undefined);
    const ifIdle = options?.ifIdle ?? ('content' in input ? input.ifIdle : undefined);
    const submittedRunId = this.run.getRunId();
    const submittedActiveRunId = this.stream.activeRunId();
    // After `abort()` the AbortController is cleared immediately but the run id
    // and active-run id linger until `run.reset()` runs (after `agent_end`).
    // Without this guard, a signal sent right after an interrupt is dispatched
    // onto the dying run and lost — the follow-up message never gets a response.
    const submittedIsRunning = this.run.isRunning();
    // An abort was requested but the previous run hasn't finished tearing down
    // yet (the flag stays set until `run.reset()` after `agent_end`). This is
    // the post-interrupt window where a fresh signal must wait for the dying
    // run to fully idle before starting a new run.
    const submittedAbortRequested = this.run.isAbortRequested();
    const submittedWhileWorking =
      submittedIsRunning || (submittedAbortRequested && Boolean(submittedRunId || submittedActiveRunId));
    // Registered before any await: resolves when the aborted live subscription is
    // detached, which the run engine does only after that run has ended.
    const abortedStreamTeardown =
      submittedAbortRequested && !submittedIsRunning && this.stream.isOpen() ? this.#watchStreamTeardown() : undefined;
    const submitted = createSignal(
      'content' in input
        ? {
            type: 'user',
            tagName: 'user',
            contents: input.content,
            providerOptions: withMessageAuthor(input.providerOptions, readMessageAuthor(requestContextInput)),
          }
        : input,
    );
    const signal = submittedWhileWorking ? asInterjection(submitted) : submitted;
    const accepted = Promise.resolve().then(async () => {
      await this.machinery.authorizeExecute?.(requestContextInput);
      const threadId = await this.thread.ensureId({ requestContext: requestContextInput });

      const agent = this.machinery.getAgent();
      await this.thread.ensureSubscription(threadId, agent, requestContextInput);
      assertNotCancelled();

      // A deferred abort (parked approval gate) leaves the AbortController
      // armed until the decline lands, so `submittedIsRunning` stays true for a
      // run that is already on its way out. Routing a signal to it would hand
      // the message to a run that `completeDeferredAbort()` then terminates.
      if (!submittedAbortRequested && submittedRunId && submittedActiveRunId && submittedIsRunning) {
        if (signal.type === 'user') {
          this.#releaseApprovalGates({
            threadId,
            declineContext: {
              reason: 'interrupted_by_user_message',
              message: 'The pending tool approval was declined because the user sent a new message.',
            },
          });
        }
        const result = agent.sendSignal(signal, {
          resourceId: this.identity.getResourceId(),
          threadId,
          ifActive,
          ifIdle,
        });
        const shouldObservePersistence = ifActive?.behavior === 'persist' || ifIdle?.behavior === 'persist';
        const settled = shouldObservePersistence || requireDelivery ? await result.accepted : undefined;
        if (settled?.action === 'persist') {
          await result.persisted;
          const message = signal.toDBMessage({
            resourceId: this.identity.getResourceId(),
            threadId,
          });
          this.emit({ type: 'message_start', message });
          this.emit({ type: 'message_end', id: message.id });
        }
        if (requireDelivery) {
          const acceptedResult = settled ?? (await result.accepted);
          return {
            accepted: true as const,
            runId: 'runId' in acceptedResult ? acceptedResult.runId : undefined,
            action: acceptedResult.action,
          };
        }
        return { accepted: true as const, runId: await settleRunId(result) };
      }

      // Post-abort lingering state: the AbortController was cleared (so
      // `submittedIsRunning` is false) but the previous run is still finalizing
      // — its run id / active-run id linger until `run.reset()` runs after
      // `agent_end`. Dispatching a fresh signal now would let the agent queue it
      // onto the dying run instead of starting a new run, and the follow-up
      // would never get a response. Wait for the stream to fully idle first.
      // Only do this in the post-abort window (an abort was requested but the
      // run hasn't reset yet) so normal idle signals aren't delayed.
      if (submittedAbortRequested && (submittedRunId || submittedActiveRunId)) {
        // A deferred abort (parked approval gate) streams nothing and only
        // leaves once the gated call is declined, so the short wait is enough.
        // A normal abort tears down for real: the model stream has to cancel
        // and the output processors (memory, billing, ...) still run on the
        // partial result, which takes longer than a second. Dispatching before
        // that completes hands the new message to the dying run, which drops
        // it, so wait for the real teardown before falling back below.
        const teardownDeadline = Date.now() + POST_ABORT_TEARDOWN_TIMEOUT_MS;
        const idle = await this.waitForStreamIdle(submittedIsRunning ? undefined : POST_ABORT_TEARDOWN_TIMEOUT_MS);
        assertNotCancelled();
        // The stream can read idle before the run engine detaches the aborted
        // subscription (it detaches, then resets the run). Ensuring the
        // subscription in that gap reuses the handle about to be detached, and
        // the new run's events never reach this session: wait for the detach.
        if (idle && abortedStreamTeardown && this.run.isAbortRequested()) {
          await abortedStreamTeardown.wait(Math.max(0, teardownDeadline - Date.now()));
          assertNotCancelled();
        }
        if (!idle) {
          // On the normal path the abort teardown detached the live subscription
          // while we waited, so the handle captured by the earlier
          // `ensureSubscription` is now dead and re-ensuring genuinely
          // re-subscribes. But when `waitForStreamIdle` times out the old run is
          // still finalizing with its subscription live and matching, so
          // `ensureSubscription` would short-circuit to a no-op and dispatch onto
          // the still-aborting run. Force teardown of the stale subscription first
          // so the re-ensure always attaches a fresh one — otherwise the new run
          // starts with no native subscription and its `agent_start`/`agent_end`
          // never reach the session, leaving `run.isRunning()` stuck true.
          this.thread.cleanupSubscription();
        }
        await this.thread.ensureSubscription(threadId, agent, requestContextInput);
        assertNotCancelled();
      } else if (abortedStreamTeardown) {
        // Stop on a run parked on a tool suspension leaves no run id behind,
        // but the stopped run's subscription is still attached and is about to
        // deliver the Stop and detach. Sending on it hands the new run's first
        // event to the stopped run, which is ended as aborted and detached, so
        // the new run's end never reaches this session. Wait briefly for that
        // detach; if it never comes, drop the subscription and the abort state
        // here. Either way the new run starts on a fresh subscription.
        await abortedStreamTeardown.wait(1_000);
        assertNotCancelled();
        if (this.stream.isOpen() && this.run.isAbortRequested()) {
          this.thread.cleanupSubscription();
          this.run.reset();
        }
        await this.thread.ensureSubscription(threadId, agent, requestContextInput);
        assertNotCancelled();
      }
      abortedStreamTeardown?.cancel();

      const startupGeneration = this.run.bindingGeneration();
      this.run.clearAbortRequested();
      const startupSignal = this.run.ensureAbortController().signal;
      const streamOptions = await this.machinery
        .buildStreamOptions({
          requestContext: requestContextInput,
          tracingContext,
          tracingOptions,
          untilIdle,
          threadId,
          abortSignal: startupSignal,
        })
        .catch(error => {
          if (
            this.run.bindingGeneration() === startupGeneration &&
            this.run.getAbortSignal() === startupSignal &&
            !this.run.getRunId() &&
            !this.stream.activeRunId()
          ) {
            this.run.reset();
          }
          throw error;
        });

      assertNotCancelled();
      if (startupSignal.aborted || this.run.bindingGeneration() !== startupGeneration) {
        throw new SessionStartupCancelledError();
      }
      const result = agent.sendSignal(signal, {
        resourceId: this.identity.getResourceId(),
        threadId,
        ifActive,
        ifIdle: { ...ifIdle, streamOptions: streamOptions as any },
      });
      void result.accepted.then(
        settled => {
          if (settled.action !== 'wake') return;
          const runId = settled.runId;
          const abort = () => agent.abortRunStream(runId);
          // Navigation can precede the first observed chunk. Release the accepted
          // action as well as its model IO, never a run this signal merely joined.
          if (startupSignal.aborted) abort();
          else startupSignal.addEventListener('abort', abort, { once: true });
        },
        () => {},
      );
      if (requireDelivery) {
        // Delivery-guaranteed path: surface the real acceptance decision and
        // propagate routing/stream-setup failures to the caller.
        const settled = await result.accepted;
        return {
          accepted: true as const,
          runId: 'runId' in settled ? settled.runId : undefined,
          action: settled.action,
        };
      }
      try {
        await Promise.race([
          result.accepted.then(() => undefined),
          new Promise<void>(resolve => setTimeout(resolve, 0)),
        ]);
      } catch (error) {
        throw error;
      }
      void result.accepted.catch(() => {});
      if (ifIdle?.behavior === 'persist') {
        await result.persisted;
      }
      return { accepted: true as const, runId: undefined };
    });

    return { id: signal.id, type: signal.type, accepted: accepted.finally(() => abortedStreamTeardown?.cancel()) };
  }

  /**
   * Send a notification signal to this session's current agent/thread.
   */
  async sendNotificationSignal(
    input: SendNotificationSignalInput,
    options: SessionSendNotificationSignalOptions = {},
  ): Promise<SendAgentNotificationSignalResult> {
    const { ifActive, ifIdle, requestContext: requestContextInput, tracingContext, tracingOptions } = options;
    await this.machinery.authorizeExecute?.(requestContextInput);
    const threadId = await this.thread.ensureId({ requestContext: requestContextInput });

    const agent = this.machinery.getAgent();
    await this.thread.ensureSubscription(threadId, agent, requestContextInput);

    if (this.run.getRunId() && this.stream.activeRunId()) {
      return agent.sendNotificationSignal(input, {
        resourceId: this.identity.getResourceId(),
        threadId,
        ifActive,
        ifIdle,
      });
    }

    const streamOptions = await this.machinery.buildStreamOptions({
      requestContext: requestContextInput,
      tracingContext,
      tracingOptions,
    });

    return agent.sendNotificationSignal(input, {
      resourceId: this.identity.getResourceId(),
      threadId,
      ifActive,
      ifIdle: { ...ifIdle, streamOptions: streamOptions as any },
    });
  }

  private async prepareMessageTarget({
    requestContext,
    tracingContext,
    tracingOptions,
    untilIdle,
    abortSignal,
    includeStreamOptions = true,
  }: {
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    untilIdle?: boolean | { maxIdleMs?: number };
    abortSignal?: AbortSignal;
    includeStreamOptions?: boolean;
  }) {
    const threadId = await this.thread.ensureId({ requestContext });
    await this.thread.ensureSubscription(threadId, undefined, requestContext);

    if (!includeStreamOptions) {
      return { resourceId: this.identity.getResourceId(), threadId };
    }

    const streamOptions = await this.machinery.buildStreamOptions({
      requestContext,
      tracingContext,
      tracingOptions,
      untilIdle,
      abortSignal,
    });

    return {
      resourceId: this.identity.getResourceId(),
      threadId,
      ifIdle: { streamOptions: streamOptions as any },
    };
  }

  /**
   * Send a message to this session's current agent and await the run. Streams
   * the response and emits events.
   */
  async sendMessage({
    content,
    files,
    tracingContext,
    tracingOptions,
    requestContext: requestContextInput,
    untilIdle,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    requestContext?: RequestContext;
    untilIdle?: boolean | { maxIdleMs?: number };
  }): Promise<void> {
    const wasActive = this.stream.isActive();
    const signal = this.sendSignal(
      {
        content: this.createMessageInput({ content, files }),
        tracingContext,
        tracingOptions,
        requestContext: requestContextInput,
        untilIdle,
      },
      { requireDelivery: true },
    );

    if (wasActive) {
      await signal.accepted;
    } else {
      await this.waitForAcceptedRunCompletion(signal.accepted);
    }
  }

  /**
   * Queue a message for the next run, or send it immediately when this session
   * is idle. Queue ordering and retry behavior are owned by the Agent runtime.
   */
  async queueMessage({
    content,
    files,
    tracingContext,
    tracingOptions,
    requestContext: requestContextInput,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    requestContext?: RequestContext;
  }): Promise<void> {
    await this.machinery.authorizeExecute?.(requestContextInput);
    const wasActive = this.stream.isActive();
    const target = await this.prepareMessageTarget({
      requestContext: requestContextInput,
      tracingContext,
      tracingOptions,
      // A message queued behind an active run must not inherit that run's abort
      // signal: aborting the active run would otherwise start the queued run
      // already aborted, silently dropping it.
      abortSignal: wasActive ? new AbortController().signal : undefined,
    });
    const messageInput = this.createMessageInput({ content, files });
    const providerOptions = withMessageAuthor(undefined, readMessageAuthor(requestContextInput));
    const result = this.machinery
      .getAgent()
      .queueMessage(providerOptions ? { contents: messageInput, providerOptions } : messageInput, target);

    if (wasActive) {
      await result.accepted;
    } else {
      await this.waitForAcceptedRunCompletion(result.accepted, { waitForDelivery: false });
    }
  }

  /** Abort the current run and send steering input without clearing queued follow-ups. */
  async steer({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    this.abort();
    await this.sendMessage({ content, requestContext });
  }

  ensureFollowUpBinding(agent: Agent, resourceId: string, threadId: string) {
    const existing = this.#followUpBinding;
    if (existing?.agent === agent && existing.resourceId === resourceId && existing.threadId === threadId)
      return existing;
    this.cleanupFollowUpBinding();
    const binding: {
      agent: Agent;
      resourceId: string;
      threadId: string;
      unsubscribe?: () => void;
    } = {
      agent,
      resourceId,
      threadId,
    };
    this.#followUpBinding = binding;
    try {
      const unsubscribe = agent.subscribeThreadEvents({ resourceId, threadId }, event => {
        if (event.type === 'queue-count-changed' && this.#followUpBinding === binding) {
          this.emit({ type: 'follow_up_queued', count: event.count });
        }
      });
      binding.unsubscribe = unsubscribe;
      if (this.#followUpBinding !== binding) {
        unsubscribe();
        return undefined;
      }
      return binding;
    } catch (error) {
      if (this.#followUpBinding === binding) this.#followUpBinding = undefined;
      throw error;
    }
  }

  /** Queue a follow-up through the Agent runtime, or send it immediately while idle. */
  async followUp({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    if (!this.run.isRunning()) return this.sendMessage({ content, requestContext });
    await this.machinery.authorizeExecute?.(requestContext);
    const threadId = this.thread.getId();
    if (!threadId) return;
    const resourceId = this.identity.getResourceId();
    const agent = this.machinery.getAgent();
    const binding = this.ensureFollowUpBinding(agent, resourceId, threadId);
    if (!binding) return;
    const operation = { generation: this.#followUpGeneration, controller: new AbortController() };
    this.#preparingFollowUps.add(operation);
    try {
      const streamOptions = await this.machinery.buildStreamOptions({
        requestContext,
        abortSignal: operation.controller.signal,
      });
      if (operation.controller.signal.aborted || operation.generation !== this.#followUpGeneration) return;
      // Once submitted, the Agent owns this work independently of the Session.
      this.#preparingFollowUps.delete(operation);
      await agent.queueMessage(
        {
          contents: this.createMessageInput({ content }),
          providerOptions: withMessageAuthor(undefined, readMessageAuthor(requestContext)),
        },
        {
          resourceId,
          threadId,
          ifIdle: { streamOptions: streamOptions as any },
        },
      ).accepted;
    } finally {
      this.#preparingFollowUps.delete(operation);
    }
  }

  cleanupFollowUpBinding(): void {
    this.#followUpGeneration += 1;
    for (const operation of this.#preparingFollowUps) operation.controller.abort();
    this.#preparingFollowUps.clear();
    const binding = this.#followUpBinding;
    this.#followUpBinding = undefined;
    binding?.unsubscribe?.();
    this.emit({ type: 'follow_up_queued', count: 0 });
  }

  /**
   * Persist a system-reminder message to this session's current thread. Returns
   * the saved message, or `null` when the session has no thread or no storage.
   */
  async saveSystemReminderMessage({
    message,
    reminderType,
    role = 'user',
    metadata,
  }: {
    message: string;
    reminderType: string;
    role?: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
  }): Promise<MastraDBMessage | null> {
    const threadId = this.thread.getId();
    if (!threadId) return null;
    return this.machinery.saveSystemReminder({
      threadId,
      resourceId: this.identity.getResourceId(),
      message,
      reminderType,
      role,
      metadata,
    });
  }

  /** Tool call ids whose response has been claimed and is still being applied. */
  #claimedToolResponses = new Set<string>();
  #suspensionAgents = new WeakMap<PendingSuspension, Agent>();

  private async resolveSuspensionAgent(address: SuspensionAddress): Promise<Agent> {
    let suspension = this.suspensions.get(address);
    const scope = this.machinery.getRunScope(address.runId);
    const warm = suspension && (scope?.get(SUSPENDED_RUN_AGENT_KEY) ?? this.#suspensionAgents.get(suspension));
    if (warm) return warm;
    const owners = new Map<Agent, string>();
    for (const agent of this.machinery.getAgents?.() ?? [this.machinery.getAgent()]) {
      const perPage = 100;
      for (let page = 0; ; page++) {
        const { runs, total } = await agent.listSuspendedRuns({
          threadId: address.threadId,
          resourceId: address.resourceId,
          page,
          perPage,
        });
        const call = runs
          .find(
            run =>
              run.runId === address.runId && run.threadId === address.threadId && run.resourceId === address.resourceId,
          )
          ?.toolCalls.find(call => call.toolCallId === address.toolCallId);
        if (call?.toolName) {
          owners.set(agent, call.toolName);
          break;
        }
        if ((page + 1) * perPage >= total) break;
      }
    }
    if (owners.size !== 1) throw new Error("Cannot uniquely identify the suspended run's owning agent");
    const [agent, toolName] = owners.entries().next().value!;
    if (!suspension) {
      this.suspensions.register({ ...address, toolName });
      suspension = this.suspensions.get(address)!;
    }
    this.#suspensionAgents.set(suspension, agent);
    scope?.set(SUSPENDED_RUN_AGENT_KEY, agent);
    return agent;
  }

  /**
   * Claim the right to answer `toolCallId` so concurrent requests cannot both be
   * acknowledged for the same pending target. Synchronous, so a caller that
   * claims and then starts the response without awaiting in between is atomic.
   * Pair with {@link releaseToolResponse} once the response settles.
   */
  claimToolResponse(toolCallId: string): boolean {
    if (this.#claimedToolResponses.has(toolCallId)) return false;
    this.#claimedToolResponses.add(toolCallId);
    return true;
  }

  /** Release a claim taken with {@link claimToolResponse}. */
  releaseToolResponse(toolCallId: string): void {
    this.#claimedToolResponses.delete(toolCallId);
  }

  /**
   * Claim the parked suspension a {@link respondToToolSuspension} call would
   * resume. Returns the resolved tool call id, or a rejection when nothing is
   * pending or another response already claimed it.
   */
  claimToolSuspension(
    toolCallId?: string,
    runId?: string,
  ):
    | { accepted: true; toolCallId: string; address: SuspensionAddress; claimKey: string }
    | Extract<SessionCommandResult, { accepted: false }> {
    const address = this.suspensions.resolveAddress({ toolCallId, runId });
    if (!address) return { accepted: false, reason: 'no_pending_suspension' };
    const claimKey = getSuspensionAddressKey(address);
    if (!this.claimToolResponse(claimKey)) return { accepted: false, reason: 'not_pending' };
    return { accepted: true, toolCallId: address.toolCallId, address, claimKey };
  }

  /**
   * Respond to a pending tool suspension. Provides resume data so the suspended
   * tool can continue. `toolCallId` selects which suspended tool to resume —
   * required when more than one is suspended concurrently; when omitted it
   * resolves to the sole pending suspension. `submit_plan` resumes are routed
   * through the plan-approval path (approval switches to the default mode).
   */
  async respondToToolSuspension({
    resumeData,
    toolCallId,
    runId,
    address: inputAddress,
    requestContext,
  }: {
    resumeData: any;
    toolCallId?: string;
    runId?: string;
    address?: SuspensionAddress;
    requestContext?: RequestContext;
  }): Promise<void> {
    const address = inputAddress ?? this.suspensions.resolveAddress({ toolCallId, runId });
    if (!address) return;

    try {
      if (!this.suspensions.has(address) && inputAddress) await this.resolveSuspensionAgent(address);
      const suspension = this.suspensions.get(address);
      if (!suspension) return;
      if (suspension.toolName === 'submit_plan') {
        await this.handlePlanApprovalResume({
          address,
          response: resumeData as SubmitPlanResumeData,
          requestContext,
        });
        return;
      }

      await this.resumeToolCall({ resumeData, address, requestContext });
    } catch (error) {
      const err = getErrorFromUnknown(error);
      const sourceIsActive =
        address.threadId === this.thread.getId() && address.resourceId === this.identity.getResourceId();
      if (!sourceIsActive) throw err;
      this.emit({ type: 'error', error: err });
      if (!this.suspensions.has(address) && this.getCurrentRunId() === address.runId)
        await this.finishAgentRun('error');
    }
  }

  /**
   * Respond to a suspended `submit_plan` tool call. Rejections resume the plan
   * tool with feedback. Approvals switch to the transition mode when needed,
   * then resume the same suspended tool so the approved tool result is persisted
   * and the model continues naturally in the target mode.
   */
  private async handlePlanApprovalResume({
    address,
    response,
    requestContext,
  }: {
    address: SuspensionAddress;
    response: SubmitPlanResumeData;
    requestContext?: RequestContext;
  }): Promise<void> {
    if (response.action === 'rejected') {
      // The caller aborts once the rejected tool result is persisted. Waiting for
      // the run to terminate here would prevent that abort from ever being sent.
      await this.resumeToolCall({
        resumeData: response,
        address,
        requestContext,
        resolveOnToolEnd: true,
      });
      return;
    }

    await this.resolveSuspensionAgent(address);
    let sourceRequestContext = await this.machinery.buildRequestContext(requestContext, {
      ...address,
      execution: true,
    });
    const context = sourceRequestContext.get('controller') as AgentControllerRequestContext<TState>;
    const sourceModeId = context.session.modeId;
    const transitionModeId = this.machinery.resolveTransitionModeId(sourceModeId);
    if (transitionModeId && transitionModeId !== sourceModeId) {
      if (context.isThreadActive?.()) {
        await this.mode.switch({ modeId: transitionModeId });
      } else {
        await context.setThreadSetting?.({ key: MODE_ID_KEY, value: transitionModeId });
      }
      sourceRequestContext = await this.machinery.buildRequestContext(sourceRequestContext, {
        ...address,
        modeId: transitionModeId,
        execution: true,
      });
    }

    await this.resumeToolCall({ resumeData: response, address, requestContext: sourceRequestContext });
  }

  /**
   * Approve a parked tool call: drive the agent to execute it. Throws when there
   * is no active run.
   *
   * `runId`/`threadId`/`resourceId` resolve the call against the run that
   * parked it rather than the session's current thread/run/resource. The run
   * engine passes its stream state's own binding because the session can switch
   * thread (or be re-scoped to another resource) while a run is still in
   * flight, and the agent locates the suspended run by `threadId`/`resourceId`
   * — resolving with the newly-bound identity would throw or land on the wrong
   * thread.
   *
   * The owning agent is read from the run scope first (the
   * {@link SUSPENDED_RUN_AGENT_KEY} invariant the resume path uses), then
   * `agent` for callers that hold no run scope, then the session's current
   * agent. `abortSignal` pins the run's own signal, because a successor run
   * replaces the session's abort controller.
   */
  async approveToolCall(input: {
    toolCallId?: string;
    requestContext?: RequestContext;
    runId?: string;
    threadId?: string;
    resourceId?: string;
    agent?: Agent;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    await this.#approveToolCall(input);
  }

  async #approveToolCall(
    {
      toolCallId,
      requestContext: requestContextInput,
      runId: inputRunId,
      threadId: inputThreadId,
      resourceId = this.identity.getResourceId(),
      agent: inputAgent,
      abortSignal: inputAbortSignal,
    }: Parameters<Session<TState>['approveToolCall']>[0],
    onDispatch?: () => void,
  ): Promise<void> {
    const runId = inputRunId ?? this.run.getRunId();
    const threadId = inputThreadId ?? this.thread.getId();
    if (!runId) {
      throw new Error('No active run to approve tool call for');
    }

    const agent =
      this.machinery.getRunScope(runId)?.get(SUSPENDED_RUN_AGENT_KEY) ?? inputAgent ?? this.machinery.getAgent();
    if (!threadId) {
      throw new Error('Cannot approve a tool call without a current thread');
    }
    const abortSignal =
      inputAbortSignal ??
      (this.thread.getId() === threadId && this.identity.getResourceId() === resourceId
        ? this.run.ensureAbortController().signal
        : new AbortController().signal);
    const requestContext = await this.machinery.buildRequestContext(requestContextInput, {
      threadId,
      resourceId,
      runId,
      abortSignal,
      execution: true,
    });
    const isYolo = (this.state.get() as Record<string, unknown>).yolo === true;
    const toolsets = await this.machinery.buildToolsets(requestContext);
    onDispatch?.();
    await agent.sendToolApproval({
      threadId,
      resourceId,
      runId,
      toolCallId,
      approved: true,
      requireToolApproval: !isYolo,
      memory: { thread: threadId, resource: resourceId },
      abortSignal,
      requestContext,
      toolsets,
      // Without the shared budget the resumed run falls back to the agent's
      // default maxSteps (~5) and ends mid-task as "complete".
      streamOptions: this.machinery.buildSharedRunOptions(requestContext),
    });
  }

  /**
   * Decline a parked tool call: drive the agent to reject it. Throws when there
   * is no active run.
   *
   * `runId`/`threadId`/`resourceId` follow the same contract as
   * {@link approveToolCall}: the run engine resolves declined calls against the
   * run that parked them, so a thread switch mid-run cannot redirect the
   * decline to another thread.
   */
  async declineToolCall(input: {
    toolCallId?: string;
    requestContext?: RequestContext;
    declineContext?: { reason?: string; message?: string };
    runId?: string;
    threadId?: string;
    resourceId?: string;
    agent?: Agent;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    await this.#declineToolCall(input);
  }

  async #declineToolCall(
    {
      toolCallId,
      requestContext: requestContextInput,
      declineContext,
      runId: inputRunId,
      threadId: inputThreadId,
      resourceId = this.identity.getResourceId(),
      agent: inputAgent,
      abortSignal: inputAbortSignal,
    }: Parameters<Session<TState>['declineToolCall']>[0],
    onDispatch?: () => void,
  ): Promise<void> {
    const runId = inputRunId ?? this.run.getRunId();
    const threadId = inputThreadId ?? this.thread.getId();
    if (!runId) {
      throw new Error('No active run to decline tool call for');
    }

    const agent =
      this.machinery.getRunScope(runId)?.get(SUSPENDED_RUN_AGENT_KEY) ?? inputAgent ?? this.machinery.getAgent();
    if (!threadId) {
      throw new Error('Cannot decline a tool call without a current thread');
    }
    const abortSignal =
      inputAbortSignal ??
      (this.thread.getId() === threadId && this.identity.getResourceId() === resourceId
        ? this.run.ensureAbortController().signal
        : new AbortController().signal);
    const requestContext = await this.machinery.buildRequestContext(requestContextInput, {
      threadId,
      resourceId,
      runId,
      abortSignal,
      execution: true,
    });
    const isYolo = (this.state.get() as Record<string, unknown>).yolo === true;
    const toolsets = await this.machinery.buildToolsets(requestContext);
    onDispatch?.();
    await agent.sendToolApproval({
      threadId,
      resourceId,
      runId,
      toolCallId,
      approved: false,
      declineContext,
      requireToolApproval: !isYolo,
      memory: { thread: threadId, resource: resourceId },
      abortSignal,
      requestContext,
      toolsets,
      // Without the shared budget the resumed run falls back to the agent's
      // default maxSteps (~5) and ends mid-task as "complete".
      streamOptions: this.machinery.buildSharedRunOptions(requestContext),
    });
  }

  private createSubscribedResumeBoundaryWaiter({
    toolCallId,
    resolveOnToolEnd = false,
  }: {
    toolCallId: string;
    resolveOnToolEnd?: boolean;
  }): { promise: Promise<void>; cancel: () => void } {
    let unsubscribe: (() => void) | undefined;
    // A teardown can drop the subscription before any terminal event arrives;
    // settle then too so the caller's tool-response claim is released.
    const lifecycleWait = new AbortController();
    const cancel = () => {
      unsubscribe?.();
      lifecycleWait.abort();
    };
    const boundary = new Promise<void>(resolve => {
      unsubscribe = this.subscribe(event => {
        const isTerminal =
          event.type === 'tool_suspended' ||
          event.type === 'tool_approval_required' ||
          event.type === 'agent_end' ||
          event.type === 'error';
        const completedResumedTool = resolveOnToolEnd && event.type === 'tool_end' && event.toolCallId === toolCallId;
        if (isTerminal || completedResumedTool) resolve();
      });
    });
    const promise = Promise.race([
      boundary,
      this.stream.waitForTeardown(lifecycleWait.signal),
      this.run.waitForTeardown(lifecycleWait.signal),
    ]).finally(cancel);

    return { promise, cancel };
  }

  private async observeSourceResume(agent: Agent, address: SuspensionAddress, requestContext: RequestContext) {
    const markerKey = 'mastra.agentController.resumeAttempt';
    const attempt = this.machinery.generateId();
    const observerContext = new RequestContext(requestContext.entries());
    let disposed = false;
    let detach = () => {
      disposed = true;
    };
    const removeDeletionListener = this.machinery.onSessionDeleted?.(() => detach());
    const subscription = await this.machinery
      .subscribeToThread({ agent, ...address, requestContext: observerContext })
      .catch(error => {
        removeDeletionListener?.();
        throw error;
      });
    detach = () => {
      disposed = true;
      subscription.unsubscribe();
    };
    if (disposed) {
      detach();
      removeDeletionListener?.();
      throw new Error('Session was deleted during resume setup');
    }
    requestContext.set(markerKey, attempt);
    const context = requestContext.get('controller') as AgentControllerRequestContext<TState>;
    context.abortSignal?.addEventListener('abort', detach, { once: true });
    if (context.abortSignal?.aborted) detach();
    let dispatched = false;
    let cancelled = false;
    const promise = (async () => {
      try {
        for await (const chunk of subscription.stream) {
          if (subscription.__getCurrentRunRequestContext?.()?.get(markerKey) !== attempt) continue;
          if (chunk.runId && chunk.runId !== address.runId) continue;
          dispatched = true;
          if (chunk.type === 'tool-call-approval') {
            if (context.isThreadActive?.()) return;
            const next = { ...address, toolCallId: chunk.payload.toolCallId };
            if (this.approval.isArmed(next)) return;
            // Keep ownership after the gate is answered: reattachment can replay
            // its approval chunk before dispatch advances the persisted run.
            const runScope = this.machinery.getRunScope(address.runId);
            const ownedCalls = runScope?.get(SOURCE_APPROVAL_CALLS_KEY) ?? new Set<string>();
            ownedCalls.add(next.toolCallId);
            runScope?.set(SOURCE_APPROVAL_CALLS_KEY, ownedCalls);
            const policy = this.resolveToolApproval(chunk.payload.toolName, address.threadId);
            const decision: Promise<ApprovalDecision> =
              policy === 'ask'
                ? this.approval.arm({ ...next, toolName: chunk.payload.toolName })
                : Promise.resolve({ decision: policy === 'allow' ? ('approve' as const) : ('decline' as const) });
            let approvalDisposed = false;
            let retainApprovalOwnership = false;
            const removeApprovalDeletionListener = this.machinery.onSessionDeleted?.(() => {
              approvalDisposed = true;
              this.approval.cancel(next);
            });
            if (policy === 'ask')
              context.emitEvent?.({
                type: 'tool_approval_required',
                threadId: address.threadId,
                toolCallId: next.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
              });
            void (async () => {
              let pendingDecision = decision;
              while (!approvalDisposed) {
                const approval = await pendingDecision;
                if (approvalDisposed) return;
                let observer: Awaited<ReturnType<Session<TState>['observeSourceResume']>> | undefined;
                let accepted = false;
                let dispatchAttempted = false;
                const deferredAbortOrigin =
                  approval.decision === 'decline' && context.isThreadActive?.()
                    ? this.takeDeferredAbortOrigin()
                    : undefined;
                retainApprovalOwnership ||= deferredAbortOrigin !== undefined;
                let abortCompleted = false;
                try {
                  const continuation = await this.machinery.buildRequestContext(
                    approval.requestContext ?? requestContext,
                    { ...next, execution: true, abortSignal: context.abortSignal },
                  );
                  if (approvalDisposed) return;
                  observer = await this.observeSourceResume(agent, next, continuation);
                  if (approvalDisposed) return;
                  const binding = { ...next, agent, requestContext: continuation, abortSignal: context.abortSignal };
                  const onDispatch = () => {
                    dispatchAttempted = true;
                  };
                  if (approval.decision === 'approve') await this.#approveToolCall(binding, onDispatch);
                  else await this.#declineToolCall({ ...binding, declineContext: approval.declineContext }, onDispatch);
                  accepted = true;
                  if (deferredAbortOrigin) {
                    this.completeDeferredAbort(deferredAbortOrigin);
                    abortCompleted = true;
                  }
                  await observer.promise;
                  return;
                } catch (error) {
                  if (approvalDisposed) return;
                  if (deferredAbortOrigin && !dispatchAttempted) {
                    await this.declineToolCall({
                      ...next,
                      agent,
                      requestContext,
                      abortSignal: context.abortSignal,
                      declineContext: { reason: ABORTED_BY_USER_REASON, message: ABORTED_BY_USER_REASON },
                    });
                  }
                  retainApprovalOwnership ||= dispatchAttempted;
                  if (
                    deferredAbortOrigin ||
                    context.abortSignal?.aborted ||
                    dispatchAttempted ||
                    accepted ||
                    observer?.dispatched()
                  )
                    throw error;
                  pendingDecision = this.approval.arm({ ...next, toolName: chunk.payload.toolName });
                  context.emitEvent?.({
                    type: 'tool_approval_required',
                    threadId: next.threadId,
                    toolCallId: next.toolCallId,
                    toolName: chunk.payload.toolName,
                    args: chunk.payload.args,
                  });
                } finally {
                  observer?.cancel();
                  if (deferredAbortOrigin && !abortCompleted) this.completeDeferredAbort(deferredAbortOrigin);
                }
              }
            })()
              .catch(error => context.emitEvent?.({ type: 'error', error: getErrorFromUnknown(error) }))
              .finally(() => {
                // Aborted or unconfirmed dispatches can leave older approval chunks.
                // Keep them suppressed until the source run's scope is disposed.
                if (!retainApprovalOwnership) ownedCalls.delete(next.toolCallId);
                if (!ownedCalls.size) runScope?.delete(SOURCE_APPROVAL_CALLS_KEY);
                removeApprovalDeletionListener?.();
              });
            return;
          }
          if (chunk.type === 'tool-call-suspended') {
            const next = { ...address, toolCallId: chunk.payload.toolCallId };
            if (!this.suspensions.has(next)) {
              this.suspensions.register({ ...next, toolName: chunk.payload.toolName });
              this.#suspensionAgents.set(this.suspensions.get(next)!, agent);
              context.emitEvent?.({
                type: 'tool_suspended',
                ...next,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                suspendPayload: chunk.payload.suspendPayload,
                resumeSchema: chunk.payload.resumeSchema,
              });
            }
            return;
          }
          if (chunk.type === 'error' || chunk.type === 'tripwire' || chunk.type === 'abort') {
            const error = getErrorFromUnknown(
              chunk.type === 'error' ? chunk.payload.error : (chunk.payload.reason ?? 'Source run terminated'),
            );
            for (const pending of this.suspensions.deleteForRun(address)) {
              context.emitEvent?.({ type: 'tool_suspension_cancelled', ...pending, reason: error.message });
            }
            throw error;
          }
          if (chunk.type === 'finish') return;
        }
        if (!cancelled) throw new Error('Source resume subscription closed before a matching run boundary');
      } finally {
        context.abortSignal?.removeEventListener('abort', detach);
        subscription.unsubscribe();
        removeDeletionListener?.();
      }
    })();
    void promise.catch(() => undefined);
    return {
      promise,
      cancel: () => {
        cancelled = true;
        subscription.unsubscribe();
      },
      dispatched: () => dispatched,
    };
  }

  /**
   * Resume a suspended tool call through the active thread subscription.
   * Re-supplies the shared run budget so the resumed run doesn't stop mid-task
   * on the agent's small default maxSteps.
   *
   * Interactive builtins (`ask_user`, `request_access`) are exempted from the
   * approval re-check on resume: their resume schema is `z.string()` /
   * `z.array(z.string())` which cannot carry the `{ approved }` field the
   * approval gate demands, so re-entering the approval branch would always
   * reject the answer. The caller already handled approval (setForTool policy,
   * yolo mode, or a prior explicit approval gate).
   */
  async resumeToolCall({
    resumeData,
    address,
    requestContext: requestContextInput,
    resolveOnToolEnd = false,
  }: {
    resumeData: any;
    address: SuspensionAddress;
    requestContext?: RequestContext;
    resolveOnToolEnd?: boolean;
  }): Promise<void> {
    const suspension = this.suspensions.get(address);
    if (!suspension) {
      throw new Error('No active suspension to resume');
    }
    const { toolCallId, threadId, resourceId } = address;

    const agent = await this.resolveSuspensionAgent(address);
    const sourceIsActive = () => threadId === this.thread.getId() && resourceId === this.identity.getResourceId();
    const abortSignal = sourceIsActive() ? this.run.ensureAbortController().signal : new AbortController().signal;
    const requestContext = await this.machinery.buildRequestContext(requestContextInput, {
      threadId,
      resourceId,
      runId: address.runId,
      abortSignal,
      execution: true,
    });
    const toolsets = await this.machinery.buildToolsets(requestContext);
    let resumedSubscriptionBoundary: { promise: Promise<void>; cancel: () => void } | undefined;
    if (sourceIsActive()) {
      await this.thread.ensureSubscription(threadId, agent, requestContext, resourceId, sourceIsActive);
      if (sourceIsActive())
        resumedSubscriptionBoundary = this.createSubscribedResumeBoundaryWaiter({ toolCallId, resolveOnToolEnd });
    }
    let observer: Awaited<ReturnType<Session<TState>['observeSourceResume']>> | undefined;
    const prompt = [...this.displayState.get().pendingSuspensions.values()].find(
      entry =>
        entry.toolCallId === toolCallId &&
        entry.runId === address.runId &&
        entry.threadId === threadId &&
        entry.resourceId === resourceId,
    );
    try {
      observer = await this.observeSourceResume(agent, address, requestContext);
      this.suspensions.delete(address);
      this.displayState.deletePendingSuspension(address);
      const sharedOptions = this.machinery.buildSharedRunOptions(requestContext);
      // Interactive builtins suspend to collect user input, not for approval.
      // The resume data is the user's answer (a bare string), which the approval
      // re-check would reject because it cannot carry an `{ approved }` field.
      // Exempt these tools so the answer reaches the model as-is.
      const isInteractive = suspension.toolName === 'ask_user' || suspension.toolName === 'request_access';
      if (isInteractive) {
        sharedOptions.requireToolApproval = false;
      }
      await agent.sendStreamResume({
        threadId,
        resourceId,
        runId: suspension.runId,
        toolCallId,
        resumeData,
        streamOptions: {
          ...sharedOptions,
          memory: { thread: threadId, resource: resourceId },
          abortSignal,
          requestContext,
          toolsets,
        },
      });
      if (resolveOnToolEnd && resumedSubscriptionBoundary) {
        await Promise.race([resumedSubscriptionBoundary.promise, observer.promise]);
        // The visible caller may acknowledge the tool result before the source
        // parks again. Its bounded observer still owns that next boundary.
        observer = undefined;
      } else {
        await observer.promise;
        await resumedSubscriptionBoundary?.promise;
      }
    } catch (error) {
      if (!observer?.dispatched()) {
        this.suspensions.register({ ...address, toolName: suspension.toolName });
        this.#suspensionAgents.set(this.suspensions.get(address)!, agent);
        if (prompt && sourceIsActive()) this.displayState.apply({ type: 'tool_suspended', ...prompt });
      }
      throw error;
    } finally {
      observer?.cancel();
      resumedSubscriptionBoundary?.cancel();
    }
  }

  /**
   * Grant a tool category "allow". Scoped to `threadId` when given; a call that
   * names no thread grants session-wide (every thread).
   */
  grantCategory(category: ToolCategory, threadId?: string): void {
    this.#grantBucket(this.#grantedCategories, threadId).add(category);
  }

  /**
   * Grant an individual tool "allow". Scoped to `threadId` when given; a call
   * that names no thread grants session-wide (every thread).
   */
  grantTool(toolName: string, threadId?: string): void {
    this.#grantBucket(this.#grantedTools, threadId).add(toolName);
  }

  /**
   * Whether the given tool category has been granted session-wide or for
   * `threadId` (default: the current thread).
   */
  hasCategoryGrant(category: ToolCategory, threadId?: string): boolean {
    return this.#hasGrant(this.#grantedCategories, category, threadId);
  }

  /**
   * Whether the given tool has been granted session-wide or for `threadId`
   * (default: the current thread).
   */
  hasToolGrant(toolName: string, threadId?: string): boolean {
    return this.#hasGrant(this.#grantedTools, toolName, threadId);
  }

  /**
   * Snapshot of the grants that apply to `threadId` (default: the current
   * thread): session-wide grants plus that thread's own.
   */
  getGrants(threadId?: string): { categories: ToolCategory[]; tools: string[] } {
    return {
      categories: [...this.#applicableGrants(this.#grantedCategories, threadId)] as ToolCategory[],
      tools: [...this.#applicableGrants(this.#grantedTools, threadId)],
    };
  }

  #grantBucket(store: Map<string, Set<string>>, threadId?: string): Set<string> {
    const key = threadId ?? SESSION_WIDE_GRANT_BUCKET;
    let bucket = store.get(key);
    if (!bucket) {
      bucket = new Set<string>();
      store.set(key, bucket);
    }
    return bucket;
  }

  #hasGrant(store: Map<string, Set<string>>, value: string, threadId?: string): boolean {
    if (store.get(SESSION_WIDE_GRANT_BUCKET)?.has(value)) return true;
    const thread = threadId ?? this.thread.getId();
    return thread ? (store.get(thread)?.has(value) ?? false) : false;
  }

  #applicableGrants(store: Map<string, Set<string>>, threadId?: string): Set<string> {
    const merged = new Set(store.get(SESSION_WIDE_GRANT_BUCKET) ?? []);
    const thread = threadId ?? this.thread.getId();
    if (thread) for (const value of store.get(thread) ?? []) merged.add(value);
    return merged;
  }

  /** A copy of the running token-usage tally for the active thread. */
  getTokenUsage(): TokenUsage {
    return { ...this.#tokenUsage };
  }

  /**
   * Replace the running tally, e.g. when hydrating from persisted thread
   * metadata on thread switch.
   */
  setTokenUsage(usage: TokenUsage): void {
    this.#tokenUsage = { ...usage };
  }

  /** Reset the running tally to zero, e.g. on a new/empty thread. */
  resetTokenUsage(): void {
    this.#tokenUsage = createEmptyTokenUsage();
  }

  /** Fold a single step's usage into the running tally. */
  addUsage(stepUsage: TokenUsage): void {
    this.#tokenUsage.promptTokens += stepUsage.promptTokens;
    this.#tokenUsage.completionTokens += stepUsage.completionTokens;
    this.#tokenUsage.totalTokens += stepUsage.totalTokens;
    addOptionalUsageField(this.#tokenUsage, 'reasoningTokens', stepUsage.reasoningTokens);
    addOptionalUsageField(this.#tokenUsage, 'cachedInputTokens', stepUsage.cachedInputTokens);
    addOptionalUsageField(this.#tokenUsage, 'cacheCreationInputTokens', stepUsage.cacheCreationInputTokens);
    addOptionalUsageField(this.#tokenUsage, 'cacheCreationInputTokens5m', stepUsage.cacheCreationInputTokens5m);
    addOptionalUsageField(this.#tokenUsage, 'cacheCreationInputTokens1h', stepUsage.cacheCreationInputTokens1h);
    if (stepUsage.raw !== undefined) {
      this.#tokenUsage.raw = stepUsage.raw;
    }
  }
}
