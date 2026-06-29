import type { Agent } from '../agent';
import { createSignal } from '../agent/signals';
import type { AgentSignalAttributes, AgentSignalContents, AgentSignalInput } from '../agent/signals';
import type {
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
import type { SendNotificationSignalInput } from '../notifications';
import type { TracingContext, TracingOptions } from '../observability';
import type { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import { safeStringify } from '../utils';
import { Workspace } from '../workspace';

import { SessionRunEngine } from './session-run-engine';
import type { TaskItemSnapshot } from './tools';
import { createEmptyTokenUsage, defaultDisplayState, defaultOMProgressState } from './types';
import type {
  AgentControllerDisplayState,
  AgentControllerEvent,
  AgentControllerEventListener,
  AgentControllerMessage,
  AgentControllerMode,
  AgentControllerOMConfig,
  AgentControllerRequestState,
  AgentControllerRequestStateUpdater,
  AgentControllerThread,
  ModelUseCountTracker,
  PermissionPolicy,
  PermissionRules,
  TokenUsage,
  ToolCategory,
} from './types';

/**
 * Minimal persistence surface the Session uses to read and write per-thread
 * settings (mode id, per-mode model id, …). The AgentController backs this with thread
 * metadata; when no storage is configured it is absent and the Session keeps
 * its state purely in memory.
 */
export interface ThreadSettingsStore {
  /** Read a setting for the active thread, or undefined when unset/unavailable. */
  get(key: string): Promise<unknown>;
  /** Persist a setting for the active thread (no-op when storage is unavailable). */
  set(key: string, value: unknown): Promise<void>;
}

/** Options for {@link Session.sendNotificationSignal}. */
export type SessionSendNotificationSignalOptions = {
  ifActive?: SendAgentNotificationSignalOptions['ifActive'];
  ifIdle?: SendAgentNotificationSignalOptions['ifIdle'];
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
  requestContext?: RequestContext;
};

/** Usage fields that are summed across steps when present on a step's usage. */
type OptionalUsageField = 'reasoningTokens' | 'cachedInputTokens' | 'cacheCreationInputTokens';

function addOptionalUsageField(usage: TokenUsage, key: OptionalUsageField, value: number | undefined): void {
  if (value !== undefined) {
    usage[key] = (usage[key] ?? 0) + value;
  }
}

/** Persisted thread-setting key for the currently-selected mode. */
const MODE_ID_KEY = 'currentModeId';
/** Persisted thread-setting key prefix for a mode's last-used model. */
const modeModelKey = (modeId: string) => `modeModelId_${modeId}`;

/**
 * Internal thread-metadata keys used by `Session.loadMetadata()` to persist
 * runtime bookkeeping (selected model/mode, observer/reflector config, token
 * usage). These share the flat thread `metadata` bag with user-provided
 * session scoping tags, so they must never be treated as tags: they are
 * skipped when stamping tags onto a thread and excluded when reading tags
 * back out of thread metadata.
 */
function isReservedThreadMetadataKey(key: string): boolean {
  return (
    key === 'currentModelId' ||
    key === MODE_ID_KEY ||
    key === 'observerModelId' ||
    key === 'reflectorModelId' ||
    key === 'observationThreshold' ||
    key === 'reflectionThreshold' ||
    key === 'tokenUsage' ||
    key.startsWith('modeModelId_')
  );
}

/**
 * Owns the session's identity: the memory `resourceId` and the active
 * `threadId` this session reads and writes under. Together they form the memory
 * binding (`{ thread, resource }`) every run uses. In a multi-user host one
 * AgentController serves many sessions, so this identity — "whose session is this, and
 * which thread is it on" — belongs to the Session, not the AgentController.
 *
 * `defaultResourceId` is the resourceId the session started with; switching to a
 * different resource (e.g. impersonation, or browsing another user's threads)
 * updates the current resourceId while the default is retained so the session
 * can return to its own identity.
 *
 * `id` is the stable identifier for this session (mirrors `SessionRecord.id` in
 * storage) and `ownerId` is the owner of this session (mirrors
 * `SessionRecord.ownerId`). Both are stable for the life of the session and do
 * not change when the resourceId is switched.
 *
 * The active thread the session is bound to lives on {@link SessionThread}, not
 * here — identity is the stable "who", the thread is the navigational "where".
 */
export class SessionIdentity {
  /** The memory resourceId the session currently reads/writes under. */
  #resourceId: string;
  /** The resourceId the session started with, retained across resource switches. */
  readonly #defaultResourceId: string;
  /** Stable session identifier (mirrors SessionRecord.id in storage). */
  readonly #id: string;
  /** Stable session owner (mirrors SessionRecord.ownerId in storage). */
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
 * storage rows to {@link AgentControllerThread}/{@link AgentControllerMessage}); when no storage
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
  listMessages(input: { threadId: string; limit?: number }): Promise<AgentControllerMessage[]>;
  /** The first user message for each given thread id. */
  firstUserMessages(input: { threadIds: string[] }): Promise<Map<string, AgentControllerMessage>>;
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
  /** Delete a thread row by id. No-op when storage is unavailable. */
  deleteThread(input: { threadId: string }): Promise<void>;
  /** Clone a thread (and its messages) via the host's memory, returning the new thread. */
  cloneThread(input: {
    sourceThreadId: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
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
  /** Open a fresh subscription to a thread's agent event stream. */
  subscribeToThread(input: { resourceId: string; threadId: string }): Promise<AgentThreadSubscription<any>>;
  /** Build the per-call stream options (instructions, memory, toolsets, abort signal, tracing). */
  buildStreamOptions(input: {
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<Record<string, unknown>>;
  /** The run budget every initial stream and resume must carry (maxSteps, provider fallbacks, …). */
  buildSharedRunOptions(): Record<string, unknown>;
  /** Resolve the toolset (built-in controller  tools + user/subagent tools) for a run. */
  buildToolsets(requestContext: RequestContext): Promise<ToolsetsInput>;
  /** Resolve the effective request context for a run, layering controller defaults. */
  buildRequestContext(requestContext?: RequestContext): Promise<RequestContext>;
  /** Persist the session's running token usage to thread metadata. */
  persistTokenUsage(): Promise<void>;
  /** Generate a new id (thread ids, message ids) using the host's id strategy. */
  generateId(): string;
  /**
   * Resolve the mode the session transitions to when a plan is approved: the
   * current mode's `transitionsTo`, else the host's default mode. Returns
   * `undefined` when the host has no default mode. The mode catalog is AgentController
   * config, so this is genuinely host-owned.
   */
  resolveTransitionModeId(): string | undefined;
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
  }): Promise<AgentControllerMessage | null>;
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

  /** Bind the session to a thread. */
  set({ threadId }: { threadId: string }): void {
    this.#threadId = threadId;
  }

  /** Clear the session's thread binding. */
  clear(): void {
    this.#threadId = null;
  }

  /** Clear the session's thread binding and release its lock when one is held. */
  async clearAndReleaseLock(): Promise<void> {
    const threadId = this.#threadId;
    this.#threadId = null;
    if (threadId) {
      await this.#store?.releaseLock(threadId);
    }
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
  async cloneToCurrentResource({
    threadId,
    expectedResourceId,
    expectedProjectPath,
  }: {
    threadId: string;
    expectedResourceId: string;
    expectedProjectPath: string;
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
  async listMessages({ threadId, limit }: { threadId: string; limit?: number }): Promise<AgentControllerMessage[]> {
    if (!this.#store) return [];
    // Only expose messages for threads this session owns.
    await this.#requireOwnedThread({ threadId });
    return this.#store.listMessages({ threadId, limit });
  }

  /** List messages for the session's active thread (empty when not bound). */
  async listActiveMessages({ limit }: { limit?: number } = {}): Promise<AgentControllerMessage[]> {
    if (this.#threadId === null) return [];
    return this.listMessages({ threadId: this.#threadId, limit });
  }

  /** The first user message for a single thread, or null. */
  async firstUserMessage({ threadId }: { threadId: string }): Promise<AgentControllerMessage | null> {
    const messages = await this.firstUserMessages({ threadIds: [threadId] });
    return messages.get(threadId) ?? null;
  }

  /** The first user message for each given thread id. */
  async firstUserMessages({ threadIds }: { threadIds: string[] }): Promise<Map<string, AgentControllerMessage>> {
    if (!this.#store || threadIds.length === 0) return new Map();
    return this.#store.firstUserMessages({ threadIds });
  }

  /** Read a setting (metadata value) for the active thread. */
  async getSetting({ key }: { key: string }): Promise<unknown> {
    if (!this.#store || this.#threadId === null) return undefined;
    return this.#store.getMetadata({ threadId: this.#threadId, key });
  }

  /** Persist a setting (metadata value) for the active thread. */
  async setSetting({ key, value }: { key: string; value: unknown }): Promise<void> {
    if (!this.#store || this.#threadId === null) return;
    await this.#store.setMetadata({ threadId: this.#threadId, key, value });
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
    this.#owner.stream.cleanup();
    this.#owner.run.reset();
  }

  /**
   * Ensure the session is subscribed to the given agent/thread stream, opening a
   * fresh subscription (and driving its run loop) when the binding changed.
   */
  async ensureSubscription(threadId: string): Promise<void> {
    const session = this.#owner;
    const agent = session.machinery.getAgent();
    const resourceId = this.#getResourceId();
    const key = SessionStream.keyFor({ agent, resourceId, threadId });
    if (session.stream.matches({ key })) return;

    this.cleanupSubscription();
    const subscription = await session.machinery.subscribeToThread({ resourceId, threadId });
    session.stream.attach({ subscription, key });
    void session.processSubscribedThreadStream(subscription);
  }

  /** Ensure a subscription for the session's active thread (no-op when unbound). */
  async ensureCurrentSubscription(): Promise<void> {
    if (this.#threadId === null) return;
    await this.ensureSubscription(this.#threadId);
  }

  /** Detach from the current thread: abort the run and tear down the subscription. */
  detachFromCurrent(): void {
    this.#owner.abort();
    this.cleanupSubscription();
  }

  /** Create a new thread, bind the session to it, and rebind the agent stream. */
  async create({ title }: { title?: string } = {}): Promise<AgentControllerThread> {
    const session = this.#owner;
    const store = this.#store;
    this.cleanupSubscription();
    const now = new Date();
    const thread: AgentControllerThread = {
      id: session.machinery.generateId(),
      resourceId: session.identity.getResourceId(),
      title: title || '',
      createdAt: now,
      updatedAt: now,
    };

    const currentStateModel = session.model.get();
    const currentMode = session.mode.resolve();
    const modelId = currentStateModel || currentMode.defaultModelId;

    const metadata: Record<string, unknown> = {};
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[`modeModelId_${session.mode.get()}`] = modelId;
    }

    // Stamp the session's scoping tags onto the thread so listings can be
    // filtered back to this session's scope (e.g. a `projectPath` per git
    // worktree). Fall back to a `projectPath` read from state for unscoped
    // sessions that still carry one in their initial state.
    const tags = session.getTags();
    if (Object.keys(tags).length > 0) {
      for (const [key, value] of Object.entries(tags)) {
        if (!isReservedThreadMetadataKey(key)) metadata[key] = value;
      }
    } else {
      const projectPath = (session.state.get() as any).projectPath;
      if (projectPath) {
        metadata.projectPath = projectPath;
      }
    }

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
        // saveThread failed after lock was swapped; restore previous lock state
        let reacquired = false;
        try {
          await store.releaseLock(thread.id);
        } catch {
          // Best-effort release of new thread lock
        }
        if (oldThreadId) {
          try {
            await store.acquireLock(oldThreadId);
            reacquired = true;
          } catch {
            // Re-acquire failed; no lock is held
          }
        }
        if (reacquired && oldThreadId) {
          this.set({ threadId: oldThreadId });
        } else {
          this.clear();
        }
        throw err;
      }
    }

    this.set({ threadId: thread.id });

    if (modelId && !currentStateModel) {
      session.model.set({ modelId });
    }

    session.resetTokenUsage();
    session.emit({ type: 'thread_created', thread });
    await this.ensureCurrentSubscription();

    return thread;
  }

  /** Rename the session's active thread. No-op when unbound or storageless. */
  async rename({ title }: { title: string }): Promise<void> {
    const store = this.#store;
    const threadId = this.#threadId;
    if (!threadId || !store?.hasStorage()) return;

    const thread = await store.getById({ threadId });
    if (thread) {
      await store.saveThread({
        thread: { ...thread, title, updatedAt: new Date() },
      });
    }
  }

  /** Clone a thread (and its messages), bind the session to the clone, and rebind the stream. */
  async clone({
    sourceThreadId,
    title,
    resourceId,
  }: {
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
  } = {}): Promise<AgentControllerThread> {
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
    });
  }

  async #cloneThread({
    sourceThreadId,
    resourceId,
    title,
    metadata,
  }: {
    sourceThreadId: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentControllerThread> {
    const session = this.#owner;
    const store = this.#store;
    if (!store) {
      throw new Error('Memory is not configured on this AgentController');
    }

    const clonedThread = await store.cloneThread({ sourceThreadId, resourceId, title, metadata });

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
    this.set({ threadId: clonedThread.id });
    await this.loadMetadata();
    session.resetTokenUsage();
    session.emit({ type: 'thread_created', thread: clonedThread });
    await this.ensureCurrentSubscription();

    return clonedThread;
  }

  /** Switch the session to an existing thread, hydrating its persisted settings and rebinding the stream. */
  async switch({ threadId, emitEvent = true }: { threadId: string; emitEvent?: boolean }): Promise<void> {
    const session = this.#owner;
    const store = this.#store;
    session.abort();
    this.cleanupSubscription();

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

    this.set({ threadId });

    await this.loadMetadata();

    if (emitEvent) {
      session.emit({ type: 'thread_changed', threadId, previousThreadId });
    }
    await this.ensureCurrentSubscription();
  }

  /** Delete a thread; when it's the active thread, clear the binding and tear down the run. */
  async delete({ threadId }: { threadId: string }): Promise<void> {
    const session = this.#owner;
    const store = this.#store;
    if (!store?.hasStorage()) return;

    // Only allow deleting threads this session owns.
    await this.#requireOwnedThread({ threadId });

    const isDeletingCurrentThread = this.#threadId === threadId;

    await store.deleteThread({ threadId });

    if (isDeletingCurrentThread) {
      try {
        await store.releaseLock(threadId);
      } catch {
        // Lock release failed; proceed with state cleanup regardless
      }
      this.cleanupSubscription();
      this.clear();
      session.resetTokenUsage();
    }

    session.emit({ type: 'thread_deleted', threadId });
  }

  /**
   * Hydrate the session's per-thread settings from the active thread's metadata:
   * token usage, the persisted mode (restored first), the per-mode model, and
   * observer/reflector model ids + thresholds. Best-effort: on any failure the
   * token tally is reset and the rest is left at defaults.
   */
  async loadMetadata(): Promise<void> {
    const session = this.#owner;
    const store = this.#store;
    const threadId = this.#threadId;
    if (!threadId || !store?.hasStorage()) {
      session.resetTokenUsage();
      return;
    }

    try {
      const thread = await store.getById({ threadId });

      // Load token usage
      const savedUsage = thread?.metadata?.tokenUsage as TokenUsage | undefined;
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

      const meta = thread?.metadata as Record<string, unknown> | undefined;
      const updates: Record<string, unknown> = {};

      // Restore the saved mode FIRST so we resolve currentModelId for the
      // correct mode. Otherwise we'd look up modeModelId_<defaultMode> first
      // and then never overwrite it when the saved mode has no per-mode
      // override persisted (e.g. user only ever used the mode's default
      // model), leaving the wrong mode's model active on restart.
      let previousModeIdForEmit: string | undefined;
      if (meta?.currentModeId) {
        const savedModeId = meta.currentModeId as string;
        const modeExists = store.getModeIds().includes(savedModeId);
        if (modeExists && savedModeId !== session.mode.get()) {
          previousModeIdForEmit = session.mode.get();
          session.mode.set({ modeId: savedModeId });
        }
      }

      // Resolve the model for the (now-restored) current mode and apply it to
      // the session (source of truth for the selected model).
      // Order: per-mode thread metadata → mode's defaultModelId → legacy
      // global currentModelId (set by create()).
      const currentModeId = session.mode.get();
      const modeModelKey = `modeModelId_${currentModeId}`;
      if (meta?.[modeModelKey]) {
        session.model.set({ modelId: meta[modeModelKey] as string });
      } else {
        const currentMode = session.mode.resolve();
        if (currentMode.defaultModelId) {
          session.model.set({ modelId: currentMode.defaultModelId });
        } else if (meta?.currentModelId) {
          session.model.set({ modelId: meta.currentModelId as string });
        }
      }

      if (previousModeIdForEmit !== undefined) {
        session.emit({
          type: 'mode_changed',
          modeId: session.mode.get(),
          previousModeId: previousModeIdForEmit,
        });
      }

      // Restore observer/reflector model IDs
      if (meta?.observerModelId) {
        updates.observerModelId = meta.observerModelId;
      }
      if (meta?.reflectorModelId) {
        updates.reflectorModelId = meta.reflectorModelId;
      }
      const hasObservationThreshold = typeof meta?.observationThreshold === 'number';
      const hasReflectionThreshold = typeof meta?.reflectionThreshold === 'number';

      if (hasObservationThreshold) {
        updates.observationThreshold = meta.observationThreshold;
      }
      if (hasReflectionThreshold) {
        updates.reflectionThreshold = meta.reflectionThreshold;
      }

      if (Object.keys(updates).length > 0) {
        await session.state.set(updates as Record<string, unknown>);
      }

      if (!hasObservationThreshold) {
        const observationThreshold = session.om.observer.threshold();
        if (observationThreshold !== undefined) {
          await this.setSetting({ key: 'observationThreshold', value: observationThreshold });
        }
      }
      if (!hasReflectionThreshold) {
        const reflectionThreshold = session.om.reflector.threshold();
        if (reflectionThreshold !== undefined) {
          await this.setSetting({ key: 'reflectionThreshold', value: reflectionThreshold });
        }
      }
    } catch {
      session.resetTokenUsage();
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
  #subscription: AgentThreadSubscription<any> | null = null;
  /** Dedup key (`agentId:resourceId:threadId`) for the open subscription, or null. */
  #key: string | null = null;
  readonly #teardownWaiters = new Set<() => void>();

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

  /** Build the dedup key identifying a subscription to `threadId` for `agent`. */
  static keyFor({ agent, resourceId, threadId }: { agent: Agent; resourceId: string; threadId: string }): string {
    return `${agent.id}:${resourceId}:${threadId}`;
  }

  /** Whether the open subscription already targets `key` (so it can be reused). */
  matches({ key }: { key: string }): boolean {
    return this.#key === key && this.#subscription !== null;
  }

  /** Adopt `subscription` as the live one, recording its dedup `key`. */
  attach({ subscription, key }: { subscription: AgentThreadSubscription<any>; key: string }): void {
    this.#subscription = subscription;
    this.#key = key;
  }

  /** Whether a subscription is currently open. */
  isOpen(): boolean {
    return this.#subscription !== null;
  }

  /** Whether `subscription` is the one currently adopted (identity check). */
  isCurrent({ subscription }: { subscription: AgentThreadSubscription<any> }): boolean {
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

  /** Abort the live subscription's in-flight run, if any. Swallows errors. */
  abort(): void {
    try {
      this.#subscription?.abort();
    } catch {}
  }

  /** Detach the live subscription without aborting (e.g. on stream error). */
  detach(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#key = null;
    this.#notifyTeardown();
  }

  /** Fully tear down the live subscription: abort, unsubscribe, and clear. */
  cleanup(): void {
    this.#subscription?.abort();
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#key = null;
    this.#notifyTeardown();
  }
}

/** A tool call parked awaiting a resume, keyed in {@link SessionSuspensions}. */
export interface PendingSuspension {
  /** The run id to resume when this tool call is answered. */
  runId: string;
  /** The suspended tool's name (e.g. `ask_user`, `submit_plan`). */
  toolName: string;
}

/**
 * Owns the session's parked tool suspensions: tool calls paused via the native
 * tool-suspension primitive (e.g. `ask_user` / `request_access` / `submit_plan`)
 * that are awaiting a resume, keyed by `toolCallId`. Each entry records the run
 * id to resume and the tool name. A Map (rather than single fields) lets several
 * tools — e.g. parallel `ask_user` calls in one step — stay suspended and be
 * resumed independently.
 *
 * This is the resume *data* the AgentController reads to drive a resume. The richer
 * per-suspension UI snapshot lives on the AgentController display state; the Session
 * owns only what's needed to resume.
 */
export class SessionSuspensions {
  /** Parked tool calls awaiting a resume, keyed by `toolCallId`. */
  readonly #pending = new Map<string, PendingSuspension>();

  /** Park `toolCallId` as awaiting a resume on `runId` for `toolName`. */
  register({ toolCallId, runId, toolName }: { toolCallId: string; runId: string; toolName: string }): void {
    this.#pending.set(toolCallId, { runId, toolName });
  }

  /** The parked suspension for `toolCallId`, or undefined when none. */
  get({ toolCallId }: { toolCallId: string }): PendingSuspension | undefined {
    return this.#pending.get(toolCallId);
  }

  /** Whether `toolCallId` is currently parked. */
  has({ toolCallId }: { toolCallId: string }): boolean {
    return this.#pending.has(toolCallId);
  }

  /** Drop `toolCallId` from the parked set (e.g. once resumed). */
  delete({ toolCallId }: { toolCallId: string }): void {
    this.#pending.delete(toolCallId);
  }

  /** Drop all parked suspensions (e.g. on abort or thread switch). */
  clear(): void {
    this.#pending.clear();
  }

  /** Whether any tool calls are parked awaiting a resume. */
  hasPending(): boolean {
    return this.#pending.size > 0;
  }

  /**
   * Resolve which parked suspension to act on. With an explicit `toolCallId` it
   * must match a parked suspension; without one it returns the single parked
   * suspension (or undefined when there are zero or several).
   */
  resolveToolCallId(toolCallId?: string): string | undefined {
    if (toolCallId) {
      return this.#pending.has(toolCallId) ? toolCallId : undefined;
    }
    if (this.#pending.size === 1) {
      return this.#pending.keys().next().value;
    }
    return undefined;
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
 * A user's response to a parked approval. `always_allow_category` approves the
 * tool and additionally grants its category for the rest of the session.
 */
export interface ApprovalResponse {
  decision: 'approve' | 'decline' | 'always_allow_category';
  requestContext?: RequestContext;
  declineContext?: { reason?: string; message?: string };
}

/**
 * Owns the session's interactive tool-approval gate: when a tool requires user
 * approval, the run parks on a promise here until the UI responds approve or
 * decline. Holds the pending resolver and the name of the tool being gated.
 *
 * At most one approval is in flight at a time. The Session owns the gate
 * mechanics (arm / resolve / clear); the AgentController still maps a decision to its
 * effects (running vs declining the tool, and any "always allow" grant), since
 * those touch config-derived tool categories.
 */
export class SessionApproval {
  /** Resolver for the parked approval promise, or null when nothing is gated. */
  #resolve: ((decision: ApprovalDecision) => void) | null = null;
  /** Name of the tool currently awaiting approval, or null when none. */
  #toolName: string | null = null;
  /** Id of the tool call currently awaiting approval, or null when none. */
  #toolCallId: string | null = null;

  /**
   * Park a new approval for `toolName`/`toolCallId` and return a promise that
   * resolves once {@link respond} is called with the user's decision. The caller
   * awaits this while the run is suspended on the gate.
   */
  arm({ toolName, toolCallId }: { toolName: string; toolCallId?: string }): Promise<ApprovalDecision> {
    this.#toolName = toolName;
    this.#toolCallId = toolCallId ?? null;
    return new Promise<ApprovalDecision>(resolve => {
      this.#resolve = resolve;
    });
  }

  /** Id of the tool call currently awaiting approval, or null when none. */
  getToolCallId(): string | null {
    return this.#toolCallId;
  }

  /** Whether an approval is currently parked awaiting a decision. */
  isArmed(): boolean {
    return this.#resolve !== null;
  }

  /**
   * Apply a user's {@link ApprovalResponse} to the parked gate. A no-op when
   * nothing is armed. When `toolCallId` is supplied it must match the gated
   * call; a mismatch is ignored so a stale/delayed response cannot resolve a
   * different pending gate. `always_allow_category` runs `onAlwaysAllow` with the
   * gated tool name (so the caller can grant the tool's category — a lookup that
   * needs AgentController config) and then approves; `approve`/`decline` resolve as-is.
   */
  respond({
    decision,
    toolCallId,
    requestContext,
    declineContext,
    onAlwaysAllow,
  }: ApprovalResponse & { toolCallId?: string; onAlwaysAllow?: (toolName: string) => void }): void {
    if (!this.isArmed()) return;
    if (toolCallId !== undefined && this.#toolCallId !== null && toolCallId !== this.#toolCallId) return;

    if (decision === 'always_allow_category' && this.#toolName) {
      onAlwaysAllow?.(this.#toolName);
    }

    const resolved: ApprovalDecision = {
      decision: decision === 'decline' ? 'decline' : 'approve',
      requestContext,
      declineContext,
    };
    this.#resolve?.(resolved);
    this.#resolve = null;
    this.#toolName = null;
    this.#toolCallId = null;
  }

  /**
   * Release a parked gate without a user decision — used when the run is
   * aborted. Resolves the awaiting producer as a `decline` so the gated tool is
   * rejected (not run) and the run can finalize. A no-op when nothing is armed.
   */
  cancel(): void {
    if (!this.isArmed()) return;
    this.#resolve?.({ decision: 'decline' });
    this.#resolve = null;
    this.#toolName = null;
    this.#toolCallId = null;
  }

  /** Clear the gated tool name/call id once a parked approval has been consumed. */
  clearToolName(): void {
    this.#toolName = null;
    this.#toolCallId = null;
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
  /** Controller whose signal cancels the active run; null when no run is armed. */
  #abortController: AbortController | null = null;
  /** Whether an abort has been requested for the current run. */
  #abortRequested = false;
  readonly #teardownWaiters = new Set<() => void>();

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
   */
  requestAbort(): void {
    this.#abortRequested = true;
    if (this.#abortController) {
      try {
        this.#abortController.abort();
      } catch {}
      this.#abortController = null;
    }
  }
}

/**
 * Owns the session's currently-selected model. Source of truth for "which model
 * is active", plus the per-mode model memory persisted to the thread-settings
 * store (so each mode remembers the model it was last used with).
 */
export class SessionModel {
  #id = '';
  readonly #store: () => ThreadSettingsStore | undefined;
  /** This session's event bus; {@link switch} emits `model_changed` here. */
  readonly #bus: SessionBus;
  /**
   * Reads the active mode id. Injected by the AgentController via {@link setResolver},
   * since {@link switch} defaults a model change to the current mode.
   */
  #getCurrentModeId: (() => string) | undefined;
  /** App hook to track model usage for ranking. Injected via {@link setResolver}. */
  #trackModelUse: ModelUseCountTracker | undefined;

  constructor(store: () => ThreadSettingsStore | undefined, bus: SessionBus) {
    this.#store = store;
    this.#bus = bus;
  }

  /**
   * Attach the AgentController-owned dependencies {@link switch} needs: the active-mode
   * accessor and the optional model-use tracker. The AgentController injects these once.
   */
  setResolver(options: { getCurrentModeId: () => string; trackModelUse?: ModelUseCountTracker }): void {
    this.#getCurrentModeId = options.getCurrentModeId;
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

  /** Persist `modelId` as the last-used model for `modeId`. */
  async saveForMode({ modeId, modelId }: { modeId: string; modelId: string }): Promise<void> {
    await this.#store()?.set(modeModelKey(modeId), modelId);
  }

  /**
   * Resolve the model for `modeId`: the persisted per-mode model if present,
   * else `defaultModelId`, else null.
   */
  async resolveForMode({
    modeId,
    defaultModelId,
  }: {
    modeId: string;
    defaultModelId?: string;
  }): Promise<string | null> {
    const stored = (await this.#store()?.get(modeModelKey(modeId))) as string | undefined;
    if (stored) return stored;
    return defaultModelId ?? null;
  }

  /**
   * Switch to a different model at runtime.
   *
   * When `scope` is `'thread'` (the default), the model is persisted as the
   * per-mode model for `modeId` so it's restored when switching back. The
   * in-memory selection only updates when the target mode is the active mode.
   * Reports the selection to the model-use tracker and emits `model_changed`.
   */
  async switch({
    modelId,
    scope = 'thread',
    modeId,
  }: {
    modelId: string;
    scope?: 'global' | 'thread';
    modeId?: string;
  }): Promise<void> {
    const currentModeId = this.#getCurrentModeId?.() ?? '';
    const targetModeId = modeId ?? currentModeId;

    if (targetModeId === currentModeId) {
      this.set({ modelId });
    }

    if (scope === 'thread') {
      await this.saveForMode({ modeId: targetModeId, modelId });
    }

    try {
      await Promise.resolve(this.#trackModelUse?.(modelId));
    } catch (error) {
      console.error('Failed to track model usage count', error);
    }

    this.#bus.emit({ type: 'model_changed', modelId, scope, modeId: targetModeId });
  }
}

/**
 * Owns the session's currently-selected mode and the logic for switching modes.
 * Holds the active mode id and runs the version-guarded switch sequence —
 * persisting the selection and coordinating the per-mode model with
 * {@link SessionModel}. The AgentController still owns the mode *definitions*
 * (`config.modes`); this owns "which mode is active" and how a switch unfolds.
 */
export class SessionMode {
  /** Id of the currently-selected mode. Empty until the AgentController resolves its default mode. */
  #id = '';
  /**
   * Monotonically increasing counter bumped on each switch. A slower in-flight
   * switch detects it was superseded by a newer one and bails.
   */
  #switchVersion = 0;
  readonly #store: () => ThreadSettingsStore | undefined;
  readonly #model: SessionModel;
  /** This session's event bus; {@link switch} emits mode_changed / model_changed here. */
  readonly #bus: SessionBus;
  /**
   * Resolves a mode id to its full definition. Injected by the AgentController via
   * {@link setResolver}, since the mode *catalog* (`config.modes`) is host config.
   */
  #resolveMode: ((modeId: string) => AgentControllerMode | null) | undefined;
  constructor(store: () => ThreadSettingsStore | undefined, model: SessionModel, bus: SessionBus) {
    this.#store = store;
    this.#model = model;
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

  /**
   * Switch to a different mode.
   *
   * Emits `mode_changed`, then runs the version-guarded sequence: remember the
   * outgoing mode's model, persist the new mode, then resolve and apply the
   * incoming mode's model — emitting `model_changed` once applied. A newer
   * switch starting mid-flight supersedes this one, which then bails before
   * emitting `model_changed`.
   */
  async switch({ modeId }: { modeId: string }): Promise<void> {
    const mode = this.#resolveMode?.(modeId) ?? null;
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    const previousModeId = this.#id;
    const previousModelId = this.#model.get();
    const version = ++this.#switchVersion;
    this.#id = modeId;

    // Emit the mode change immediately so UIs can update without waiting for
    // the storage round-trips below.
    this.#bus.emit({ type: 'mode_changed', modeId, previousModeId });

    // Remember the outgoing mode's model before moving on.
    if (previousModelId) {
      await this.#model.saveForMode({ modeId: previousModeId, modelId: previousModelId });
    }
    if (this.#switchVersion !== version) return;

    await this.#store()?.set(MODE_ID_KEY, modeId);
    if (this.#switchVersion !== version) return;

    const modelId = await this.#model.resolveForMode({ modeId, defaultModelId: mode.defaultModelId });
    if (this.#switchVersion !== version) return;
    if (modelId) {
      this.#model.set({ modelId });
      this.#bus.emit({ type: 'model_changed', modelId } as AgentControllerEvent);
    }
  }
}

/** Per-role wiring + state/config keys a {@link SessionOMRole} reads and writes. */
interface SessionOMRoleConfig {
  /** The event `role` and `om_model_changed` discriminator for this role. */
  role: 'observer' | 'reflector';
  /** Session-state / thread-settings key holding this role's model id. */
  modelIdKey: 'observerModelId' | 'reflectorModelId';
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
  #setState: ((updates: Record<string, unknown>) => void) | undefined;
  #setSetting: ((args: { key: string; value: unknown }) => Promise<void>) | undefined;
  #omConfig: AgentControllerOMConfig | undefined;
  #gateways: MastraModelGatewayInterface[] | undefined;

  constructor(config: SessionOMRoleConfig, bus: SessionBus) {
    this.#config = config;
    this.#bus = bus;
  }

  /** @internal Injected by {@link SessionOM.setResolver}. */
  setWiring(wiring: {
    getState: () => Record<string, unknown>;
    setState: (updates: Record<string, unknown>) => void;
    setSetting: (args: { key: string; value: unknown }) => Promise<void>;
    omConfig?: AgentControllerOMConfig;
    gateways?: MastraModelGatewayInterface[];
  }): void {
    this.#getState = wiring.getState;
    this.#setState = wiring.setState;
    this.#setSetting = wiring.setSetting;
    this.#omConfig = wiring.omConfig;
    this.#gateways = wiring.gateways;
  }

  /** This role's model id from session state, falling back to `omConfig`. */
  modelId(): string | undefined {
    const fromState = this.#getState?.()[this.#config.modelIdKey];
    return (typeof fromState === 'string' ? fromState : undefined) ?? this.#config.defaultModelId(this.#omConfig);
  }

  /** This role's threshold from session state, falling back to `omConfig`. */
  threshold(): number | undefined {
    const fromState = this.#getState?.()[this.#config.thresholdKey];
    return (typeof fromState === 'number' ? fromState : undefined) ?? this.#config.defaultThreshold(this.#omConfig);
  }

  /**
   * Resolve this role's model id to a model instance via the configured
   * gateways, or undefined when unset. The bare model id string is routed
   * through {@link ModelRouterLanguageModel}, which selects the matching
   * gateway (or the built-in defaults) and resolves provider auth.
   */
  resolvedModel(): MastraModelConfig | undefined {
    const modelId = this.modelId();
    if (!modelId) return undefined;
    return new ModelRouterLanguageModel(modelId as `${string}/${string}`, this.#gateways);
  }

  /** Switch this role's model: update session state, persist, and emit. */
  async switchModel({ modelId }: { modelId: string }): Promise<void> {
    this.#setState?.({ [this.#config.modelIdKey]: modelId });
    await this.#setSetting?.({ key: this.#config.modelIdKey, value: modelId });
    this.#bus.emit({ type: 'om_model_changed', role: this.#config.role, modelId });
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
    setState: (updates: Record<string, unknown>) => void;
    setSetting: (args: { key: string; value: unknown }) => Promise<void>;
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
  #setState: ((updates: Record<string, unknown>) => void) | undefined;
  #setSetting: ((args: { key: string; value: unknown }) => Promise<void>) | undefined;

  constructor(bus: SessionBus) {
    this.#bus = bus;
  }

  /** @internal Injected by {@link SessionSubagents.setResolver}. */
  setWiring(wiring: {
    getState: () => Record<string, unknown>;
    setState: (updates: Record<string, unknown>) => void;
    setSetting: (args: { key: string; value: unknown }) => Promise<void>;
  }): void {
    this.#getState = wiring.getState;
    this.#setState = wiring.setState;
    this.#setSetting = wiring.setSetting;
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
    this.#setState?.({ [key]: modelId });
    await this.#setSetting?.({ key, value: modelId });
    this.#bus.emit({ type: 'subagent_model_changed', modelId, scope: 'thread', agentType });
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
    setState: (updates: Record<string, unknown>) => void;
    setSetting: (args: { key: string; value: unknown }) => Promise<void>;
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
class SessionState<TState = unknown> {
  #state: TState;
  #updateQueue: Promise<void> = Promise.resolve();
  readonly #schema: StandardSchemaWithJSON | undefined;
  readonly #bus: SessionBus;

  constructor({ initialState, stateSchema }: SessionStateOptions<TState>, bus: SessionBus) {
    this.#schema = stateSchema ? toStandardSchema(stateSchema) : undefined;
    this.#state = {
      ...this.getSchemaDefaults(),
      ...(initialState as Record<string, unknown> | undefined),
    } as TState;
    this.#bus = bus;
  }

  get(): Readonly<TState> {
    return { ...(this.#state as Record<string, unknown>) } as TState;
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

  private async apply(updates: Partial<TState>): Promise<void> {
    const changedKeys = Object.keys(updates as Record<string, unknown>);
    const newState = { ...(this.#state as Record<string, unknown>), ...(updates as Record<string, unknown>) };

    if (this.#schema) {
      const result = await this.#schema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map(i => i.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      this.#state = result.value as TState;
    } else {
      this.#state = newState as TState;
    }

    this.#bus.emit({ type: 'state_changed', state: this.get() as Record<string, unknown>, changedKeys });
  }

  set(updates: Partial<TState>): Promise<void> {
    const updateSnapshot = { ...(updates as Record<string, unknown>) } as Partial<TState>;
    const run = this.#updateQueue.then(() => this.apply(updateSnapshot));
    this.#updateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  update<TResult>(updater: SessionStateUpdater<TState, TResult>): Promise<TResult> {
    const run = this.#updateQueue.then(async () => {
      const update = await updater(this.get());
      if (update.updates && Object.keys(update.updates as Record<string, unknown>).length > 0) {
        await this.apply(update.updates);
      }
      for (const event of update.events ?? []) {
        this.#bus.emit(event);
      }
      return update.result;
    });

    this.#updateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
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
 * - the follow-up queue (`session.followUps`): messages a user submits while a
 *   run is in progress, held FIFO until the run finishes. The Session owns the
 *   queue; the AgentController drives draining and keeps the `queuedFollowUps` display
 *   mirror.
 * - the interactive tool-approval gate (`session.approval`): when a tool needs
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

  /**
   * Drop the display mirror of a single parked tool suspension once it has been
   * resumed, so the UI stops rendering only the resolved prompt while any other
   * parked suspensions stay visible.
   */
  deletePendingSuspension(toolCallId: string): void {
    this.#state.pendingSuspensions.delete(toolCallId);
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
    ds.pendingApproval = null;
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
        ds.pendingApproval = null;
        // Parked tool suspensions are intentionally NOT cleared here: resuming
        // one parked tool restarts the run (a fresh agent_start) and the other
        // parallel prompts must stay rendered until they are resolved.
        break;

      case 'agent_end':
        ds.isRunning = false;
        ds.pendingApproval = null;
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
        ds.currentMessage = event.message;
        break;

      case 'message_update':
        ds.currentMessage = event.message;
        break;

      case 'message_end':
        ds.currentMessage = event.message;
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
        if (buf) {
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
        ds.pendingApproval = {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        };
        break;

      case 'tool_suspended':
        ds.pendingSuspensions.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          suspendPayload: event.suspendPayload,
          resumeSchema: event.resumeSchema,
        });
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
export class SessionBus {
  readonly #listeners: AgentControllerEventListener[] = [];
  #displayState: SessionDisplayState | undefined;
  /**
   * The last workspace lifecycle event group emitted on this bus, replayed to
   * subscribers that attach after the workspace finished initializing. Without
   * this, late listeners (the normal pattern: create a session, then subscribe)
   * would never see the workspace ready/error status.
   */
  #lastWorkspaceEvents: AgentControllerEvent[] = [];

  /** Attach the display-state reducer the bus folds events into. Set once by the Session. */
  setDisplayState(displayState: SessionDisplayState): void {
    this.#displayState = displayState;
  }

  subscribe(listener: AgentControllerEventListener): () => void {
    // Replay buffered workspace lifecycle events so late subscribers learn the
    // current workspace status. The workspace is initialized during session
    // creation, before any external caller can subscribe.
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
    this.#dispatch(event);
    if (event.type !== 'display_state_changed' && this.#displayState) {
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

export class Session<TState = unknown> {
  /** This session's event bus. Constructed first so every subsystem can route its events here. */
  readonly #bus = new SessionBus();
  /** Tool categories the user has granted "allow" for the lifetime of this session. */
  readonly #grantedCategories = new Set<string>();
  /** Individual tool names the user has granted "allow" for the lifetime of this session. */
  readonly #grantedTools = new Set<string>();
  /** Running token-usage tally for the active thread. */
  #tokenUsage: TokenUsage = createEmptyTokenUsage();
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
  /** The session's currently-selected model (source of truth) + per-mode memory. */
  readonly model = new SessionModel(() => this.#store, this.#bus);
  /** The session's currently-selected mode and switch sequence. */
  readonly mode = new SessionMode(() => this.#store, this.model, this.#bus);
  /** The session's observational-memory model selection (observer/reflector). */
  readonly om = new SessionOM(this.#bus);
  /** The session's persisted tool-permission rules (per-category / per-tool). */
  readonly permissions = new SessionPermissions();
  /** The session's subagent configuration (currently the subagent model). */
  readonly subagents = new SessionSubagents(this.#bus);
  /** Transient run identity (run id, trace id, operation counter) for the active run. */
  readonly run = new SessionRun();
  /** Live subscription to the active thread's agent event stream. */
  readonly stream = new SessionStream();
  /** Tool calls parked awaiting a resume (the resume data, keyed by toolCallId). */
  readonly suspensions = new SessionSuspensions();
  /** Messages queued to send after the active run finishes. */
  readonly followUps = new SessionFollowUps();
  /** The interactive tool-approval gate the current run parks on. */
  readonly approval = new SessionApproval();
  /** The session's identity: the memory resourceId it reads/writes under. */
  readonly identity: SessionIdentity;
  /** The session's thread domain: current binding + reads scoped to it. */
  readonly thread: SessionThread;
  /** The canonical display state a UI renders, plus the reducer that maintains it. */
  readonly displayState: SessionDisplayState;
  /** The session-owned AgentController state domain. */
  readonly state: AgentControllerRequestState<TState>;
  /**
   * Scoping tags for this session (e.g. `{ projectPath }`). Seeded at creation
   * and stamped onto every thread this session creates so thread listings can be
   * filtered back to the session's scope. Empty when the session is unscoped.
   */
  readonly #tags: Record<string, string>;
  readonly #workspace: Workspace;
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
    workspace: Workspace;
    browser?: MastraBrowser;
  }) {
    this.#tags = tags && Object.keys(tags).length > 0 ? { ...tags } : {};
    this.identity = new SessionIdentity({ resourceId, id, ownerId });
    this.thread = new SessionThread(() => this.identity.getResourceId());
    this.displayState = new SessionDisplayState({
      getTokenUsage: () => this.getTokenUsage(),
      getSubagentDisplayName: agentType => this.#resolveSubagentName?.(agentType),
      getThreadId: () => this.thread.getId(),
      clearFollowUps: () => this.followUps.clear(),
    });
    this.#bus.setDisplayState(this.displayState);
    this.state = new SessionState(state ?? { initialState: {} as TState }, this.#bus);

    if (!workspace || !(workspace instanceof Workspace)) {
      throw new Error(`A session requires a valid workspace instance.`);
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

  /**
   * Emit an event on this session. Delegates to this session's bus, which folds
   * the event into the canonical display state, dispatches to this session's
   * listeners, then fans out a synthetic `display_state_changed`.
   */
  emit(event: AgentControllerEvent): void {
    this.#bus.emit(event);
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
   * run engine. Used by the initial run path and tool resume.
   */
  processStream(
    response: { fullStream: AsyncIterable<any> },
    requestContext?: RequestContext,
  ): Promise<{ message: AgentControllerMessage; suspended?: boolean } | undefined> {
    return this.runEngine.processStream(response, requestContext);
  }

  /**
   * Drive the run loop for a subscribed thread stream: process each run's chunks
   * and finalize it. Delegates to the per-session run engine.
   */
  processSubscribedThreadStream(subscription: AgentThreadSubscription<any>): Promise<void> {
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
  abortRun(): void {
    this.suspensions.clear();
    this.approval.cancel();
    this.stream.abort();
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
  abort(): void {
    const hadPendingSuspensions = this.displayState.get().pendingSuspensions.size > 0;
    this.displayState.clearPendingSuspensions();
    this.abortRun();
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
   * session-scoped grant, then the tool's category grant/policy, falling back to
   * "ask". Pure session state plus the injected category resolver.
   */
  resolveToolApproval(toolName: string): PermissionPolicy {
    const state = this.state.get() as Record<string, unknown>;
    const rules = this.permissions.getRules();

    const toolPolicy = rules.tools[toolName];
    if (toolPolicy === 'deny') return 'deny';

    if (state.yolo === true) return 'allow';

    if (toolPolicy) return toolPolicy;

    if (this.hasToolGrant(toolName)) return 'allow';

    const category = this.#resolveCategory?.(toolName);
    if (category) {
      if (this.hasCategoryGrant(category)) return 'allow';
      const categoryPolicy = rules.categories[category];
      if (categoryPolicy) return categoryPolicy;
    }

    return 'ask';
  }

  /**
   * Respond to the parked tool-approval gate with the user's decision. A no-op
   * when nothing is awaiting approval. "always_allow_category" grants the gated
   * tool's category for the rest of the session (resolved via the injected
   * {@link setCategoryResolver}) and then approves; "approve"/"decline" release
   * the run as-is.
   */
  respondToToolApproval({
    decision,
    toolCallId,
    requestContext,
    declineContext,
  }: {
    decision: 'approve' | 'decline' | 'always_allow_category';
    toolCallId?: string;
    requestContext?: RequestContext;
    declineContext?: { reason?: string; message?: string };
  }): void {
    this.approval.respond({
      decision,
      toolCallId,
      requestContext,
      declineContext,
      onAlwaysAllow: toolName => {
        const category = this.#resolveCategory?.(toolName);
        if (category) this.grantCategory(category);
      },
    });
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
   * Resolve once this session's stream is fully idle.
   *
   * After `abort()` is called the run's status can still be `'running'` for a
   * few microtasks while the underlying model stream finalizes. Callers that
   * need to send a fresh signal after an abort (e.g. plan approval → mode
   * switch → trigger reminder) should await this before calling `sendSignal`
   * to avoid the new signal being queued onto the dying run, which would then
   * be drained with the previous run's already-aborted abortSignal.
   */
  private async waitForStreamIdle(timeoutMs = 1_000): Promise<void> {
    if (!this.stream.isActive() && this.run.getRunId() === null) return;

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
        if (result === 'timeout') return;
      }
    } finally {
      lifecycleWait?.abort();
      if (timeout) clearTimeout(timeout);
    }
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
          ifActive?: { attributes?: AgentSignalAttributes };
          ifIdle?: { attributes?: AgentSignalAttributes };
          tracingContext?: TracingContext;
          tracingOptions?: TracingOptions;
          requestContext?: RequestContext;
        },
  ): { id: string; type: AgentSignalInput['type']; accepted: Promise<{ accepted: true; runId?: string }> } {
    const settleRunId = async <T>(result: {
      accepted: Promise<SendAgentSignalAccepted<T>>;
    }): Promise<string | undefined> => {
      // Best-effort run id for telemetry. A wake whose stream setup fails rejects
      // `accepted`; that error surfaces to the controller through the thread subscription
      // as an error event, so we must not let it reject the session send here.
      const settled = await result.accepted.catch(() => undefined);
      return settled && 'runId' in settled ? settled.runId : undefined;
    };
    const { tracingContext, tracingOptions, requestContext: requestContextInput } = 'content' in input ? input : {};
    const ifActive = 'content' in input ? input.ifActive : undefined;
    const ifIdle = 'content' in input ? input.ifIdle : undefined;
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
    const signal = createSignal(
      'content' in input ? { type: 'user', tagName: 'user', contents: input.content } : input,
    );
    const accepted = Promise.resolve().then(async () => {
      if (!this.thread.getId()) {
        const thread = await this.thread.create();
        this.thread.set({ threadId: thread.id });
      }
      const threadId = this.thread.getId()!;

      const agent = this.machinery.getAgent();
      await this.thread.ensureSubscription(threadId);

      if (submittedRunId && submittedActiveRunId && submittedIsRunning) {
        this.approval.respond({
          decision: 'decline',
          declineContext: {
            reason: 'interrupted_by_user_message',
            message: 'The pending tool approval was declined because the user sent a new message.',
          },
        });
        const result = agent.sendSignal(signal, {
          resourceId: this.identity.getResourceId(),
          threadId,
          ifActive,
          ifIdle,
        });
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
        await this.waitForStreamIdle();
      }

      const streamOptions = await this.machinery.buildStreamOptions({
        requestContext: requestContextInput,
        tracingContext,
        tracingOptions,
      });

      const result = agent.sendSignal(signal, {
        resourceId: this.identity.getResourceId(),
        threadId,
        ifActive,
        ifIdle: { ...ifIdle, streamOptions: streamOptions as any },
      });
      try {
        await Promise.race([
          result.accepted.then(() => undefined),
          new Promise<void>(resolve => setTimeout(resolve, 0)),
        ]);
      } catch (error) {
        throw error;
      }
      void result.accepted.catch(() => {});
      return { accepted: true as const, runId: undefined };
    });

    return { id: signal.id, type: signal.type, accepted };
  }

  /**
   * Send a notification signal to this session's current agent/thread.
   */
  async sendNotificationSignal(
    input: SendNotificationSignalInput,
    options: SessionSendNotificationSignalOptions = {},
  ): Promise<SendAgentNotificationSignalResult> {
    const { ifActive, ifIdle, requestContext: requestContextInput, tracingContext, tracingOptions } = options;
    if (!this.thread.getId()) {
      const thread = await this.thread.create();
      this.thread.set({ threadId: thread.id });
    }
    const threadId = this.thread.getId()!;

    const agent = this.machinery.getAgent();
    await this.thread.ensureSubscription(threadId);

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
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    requestContext?: RequestContext;
  }): Promise<void> {
    const messageInput = this.createMessageInput({ content, files });

    const wasActive = this.stream.isActive();
    let resolveAgentEnd: (() => void) | undefined;
    const agentEnd = new Promise<void>(resolve => {
      resolveAgentEnd = resolve;
    });
    const unsubscribeAgentEnd = wasActive
      ? undefined
      : this.subscribe(event => {
          if (event.type === 'agent_end') {
            resolveAgentEnd?.();
          }
        });
    const signal = this.sendSignal({
      content: messageInput,
      tracingContext,
      tracingOptions,
      requestContext: requestContextInput,
    });
    if (wasActive) {
      await signal.accepted;
    } else {
      const acceptedFailure = signal.accepted.then(
        () => new Promise<void>(() => {}),
        error => Promise.reject(error),
      );
      try {
        await Promise.race([agentEnd, acceptedFailure]);
      } finally {
        unsubscribeAgentEnd?.();
      }
    }
    return;
  }

  /**
   * Steer the agent mid-stream: aborts the current run and sends a new message.
   */
  async steer({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    this.abort();
    this.followUps.clear();
    this.emit({ type: 'follow_up_queued', count: 0 });
    await this.sendMessage({ content, requestContext });
  }

  /**
   * Queue a follow-up message to be processed after the current run completes,
   * or send it immediately when the session is idle.
   */
  async followUp({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    if (this.run.isRunning()) {
      this.followUps.enqueue({ content, requestContext });
      this.emit({ type: 'follow_up_queued', count: this.followUps.count() });
    } else {
      await this.sendMessage({ content, requestContext });
    }
  }

  /**
   * Send the next queued follow-up message after a run finishes. Called by the
   * run engine when a run ends. Re-queues on failure so the message isn't lost.
   */
  async drainFollowUpQueue(options?: {
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<boolean> {
    if (this.followUps.isEmpty()) return false;

    const next = this.followUps.dequeue()!;
    const threadId = this.thread.getId();
    try {
      if (this.stream.isOpen() && threadId) {
        const agent = this.machinery.getAgent();
        const streamOptions = await this.machinery.buildStreamOptions({
          requestContext: next.requestContext,
          tracingContext: options?.tracingContext,
          tracingOptions: options?.tracingOptions,
        });
        const result = agent.queueMessage(this.createMessageInput({ content: next.content }), {
          resourceId: this.identity.getResourceId(),
          threadId,
          ifIdle: { streamOptions: streamOptions as any },
        });
        // Let a rejected `accepted` propagate: `next` is already dequeued, so a
        // setup/misconfig failure must reach the outer catch to requeue it
        // rather than being swallowed into a false success (the follow-up would
        // otherwise be lost).
        const accepted = await result.accepted;
        const runId = 'runId' in accepted ? accepted.runId : undefined;
        this.emit({ type: 'follow_up_queued', count: this.followUps.count(), runId });
      } else {
        this.emit({ type: 'follow_up_queued', count: this.followUps.count() });
        await this.sendMessage({
          content: next.content,
          requestContext: next.requestContext,
          tracingContext: options?.tracingContext,
          tracingOptions: options?.tracingOptions,
        });
      }
      return true;
    } catch (error) {
      this.followUps.requeue(next);
      this.emit({ type: 'follow_up_queued', count: this.followUps.count() });
      throw error;
    }
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
  }): Promise<AgentControllerMessage | null> {
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
    requestContext,
  }: {
    resumeData: any;
    toolCallId?: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    const resolvedToolCallId = this.suspensions.resolveToolCallId(toolCallId);
    if (!resolvedToolCallId) return;

    const suspension = this.suspensions.get({ toolCallId: resolvedToolCallId });

    try {
      if (suspension?.toolName === 'submit_plan') {
        await this.handlePlanApprovalResume({
          toolCallId: resolvedToolCallId,
          response: resumeData as { action: 'approved' | 'rejected'; feedback?: string },
          requestContext,
        });
        return;
      }

      await this.resumeToolCall({
        resumeData,
        toolCallId: resolvedToolCallId,
        requestContext,
      });
    } catch (error) {
      const err = getErrorFromUnknown(error);
      this.emit({ type: 'error', error: err });
      this.emit({ type: 'agent_end', reason: 'error' });
    }
  }

  /**
   * Respond to a suspended `submit_plan` tool call. Rejections resume the plan
   * tool with feedback. Approvals switch to the transition mode when needed,
   * then resume the same suspended tool so the approved tool result is persisted
   * and the model continues naturally in the target mode.
   */
  private async handlePlanApprovalResume({
    toolCallId,
    response,
    requestContext,
  }: {
    toolCallId: string;
    response: { action: 'approved' | 'rejected'; feedback?: string };
    requestContext?: RequestContext;
  }): Promise<void> {
    if (response.action === 'rejected') {
      await this.resumeToolCall({ resumeData: response, toolCallId, requestContext });
      return;
    }

    const transitionModeId = this.machinery.resolveTransitionModeId();
    if (transitionModeId && transitionModeId !== this.mode.get()) {
      await new Promise(resolveTimeout => setTimeout(resolveTimeout, 0));
      await this.mode.switch({ modeId: transitionModeId });
    }

    await this.resumeToolCall({ resumeData: response, toolCallId, requestContext });
  }

  /**
   * Approve a parked tool call: drive the agent to execute it. Throws when there
   * is no active run.
   */
  async approveToolCall({
    toolCallId,
    requestContext: requestContextInput,
  }: {
    toolCallId?: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    const runId = this.run.getRunId();
    if (!runId) {
      throw new Error('No active run to approve tool call for');
    }

    const agent = this.machinery.getAgent();
    const requestContext = await this.machinery.buildRequestContext(requestContextInput);
    const isYolo = (this.state.get() as Record<string, unknown>).yolo === true;
    const threadId = this.thread.getId();
    if (!threadId) {
      throw new Error('Cannot approve a tool call without a current thread');
    }
    const resourceId = this.identity.getResourceId();
    await agent.sendToolApproval({
      threadId,
      resourceId,
      runId,
      toolCallId,
      approved: true,
      requireToolApproval: !isYolo,
      memory: { thread: threadId, resource: resourceId },
      abortSignal: this.run.ensureAbortController().signal,
      requestContext,
      toolsets: await this.machinery.buildToolsets(requestContext),
    });
  }

  /**
   * Decline a parked tool call: drive the agent to reject it. Throws when there
   * is no active run.
   */
  async declineToolCall({
    toolCallId,
    requestContext: requestContextInput,
    declineContext,
  }: {
    toolCallId?: string;
    requestContext?: RequestContext;
    declineContext?: { reason?: string; message?: string };
  }): Promise<void> {
    const runId = this.run.getRunId();
    if (!runId) {
      throw new Error('No active run to decline tool call for');
    }

    const agent = this.machinery.getAgent();
    const requestContext = await this.machinery.buildRequestContext(requestContextInput);
    const isYolo = (this.state.get() as Record<string, unknown>).yolo === true;
    const threadId = this.thread.getId();
    if (!threadId) {
      throw new Error('Cannot decline a tool call without a current thread');
    }
    const resourceId = this.identity.getResourceId();
    await agent.sendToolApproval({
      threadId,
      resourceId,
      runId,
      toolCallId,
      approved: false,
      declineContext,
      requireToolApproval: !isYolo,
      memory: { thread: threadId, resource: resourceId },
      abortSignal: this.run.ensureAbortController().signal,
      requestContext,
      toolsets: await this.machinery.buildToolsets(requestContext),
    });
  }

  private createSubscribedResumeBoundaryWaiter(toolCallId?: string): { promise: Promise<void>; cancel: () => void } {
    let unsubscribe: (() => void) | undefined;
    const promise = new Promise<void>(resolve => {
      unsubscribe = this.subscribe(event => {
        if (
          event.type === 'tool_suspended' ||
          event.type === 'agent_end' ||
          event.type === 'error' ||
          (event.type === 'tool_end' && toolCallId && event.toolCallId === toolCallId)
        ) {
          unsubscribe?.();
          resolve();
        }
      });
    });

    return { promise, cancel: () => unsubscribe?.() };
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
    toolCallId,
    requestContext: requestContextInput,
  }: {
    resumeData: any;
    toolCallId: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    const suspension = this.suspensions.get({ toolCallId });
    if (!suspension) {
      throw new Error('No active suspension to resume');
    }

    const agent = this.machinery.getAgent();

    // Remove before resuming so a re-suspend during the resumed run can
    // re-register the same toolCallId without being clobbered by this cleanup.
    // Drop the matching display-state entry too so the UI stops rendering the
    // resolved prompt while any other parked suspensions stay visible.
    this.suspensions.delete({ toolCallId });
    this.displayState.deletePendingSuspension(toolCallId);

    const requestContext = await this.machinery.buildRequestContext(requestContextInput);
    const threadId = this.thread.getId();
    if (!threadId) {
      throw new Error('Cannot resume a suspended tool without a current thread');
    }

    await this.thread.ensureSubscription(threadId);
    const resumedSubscriptionBoundary = this.createSubscribedResumeBoundaryWaiter(
      suspension.toolName === 'submit_plan' ? toolCallId : undefined,
    );

    try {
      const resourceId = this.identity.getResourceId();
      const sharedOptions = this.machinery.buildSharedRunOptions();
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
          abortSignal: this.run.ensureAbortController().signal,
          requestContext,
          toolsets: await this.machinery.buildToolsets(requestContext),
        },
      });
      await resumedSubscriptionBoundary.promise;
    } finally {
      resumedSubscriptionBoundary.cancel();
    }
  }

  /** Grant a tool category "allow" for the remainder of the session. */
  grantCategory(category: ToolCategory): void {
    this.#grantedCategories.add(category);
  }

  /** Grant an individual tool "allow" for the remainder of the session. */
  grantTool(toolName: string): void {
    this.#grantedTools.add(toolName);
  }

  /** Whether the given tool category has been granted for the session. */
  hasCategoryGrant(category: ToolCategory): boolean {
    return this.#grantedCategories.has(category);
  }

  /** Whether the given tool has been granted for the session. */
  hasToolGrant(toolName: string): boolean {
    return this.#grantedTools.has(toolName);
  }

  /** Snapshot of all session-scoped grants. */
  getGrants(): { categories: ToolCategory[]; tools: string[] } {
    return {
      categories: [...this.#grantedCategories] as ToolCategory[],
      tools: [...this.#grantedTools],
    };
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
    if (stepUsage.raw !== undefined) {
      this.#tokenUsage.raw = stepUsage.raw;
    }
  }
}
