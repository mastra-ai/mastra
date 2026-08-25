import { randomUUID } from 'node:crypto';

import { Agent } from '../agent';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage, MastraMessageContentV2 } from '../agent/message-list/state/types';
import { isUserAuthoredMessage } from '../agent/signals';
import type { ActiveThreadRun } from '../agent/thread-stream-runtime';
import type { AgentInstructions, ToolsInput, ToolsetsInput } from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
import { AgentControllerChannels } from '../channels/agent-controller-channels';
import { GatewayManager } from '../llm/model/gateways';
import { defaultGateways } from '../llm/model/gateways/defaults';
import type { MastraModelConfig } from '../llm/model/shared.types';
import { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { StorageThreadType } from '../memory/types';
import type { TracingContext, TracingOptions } from '../observability';
import { RequestContext } from '../request-context';
import type { MastraCompositeStore } from '../storage/base';
import type { MemoryStorage } from '../storage/domains/memory/base';
import type { ObservationalMemoryRecord } from '../storage/types';
import type { DynamicArgument } from '../types';
import { Workspace } from '../workspace/workspace';

import { Session } from './session';
import type { ThreadDataStore } from './session';
import {
  askUserTool,
  createSubagentTool,
  submitPlanTool,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool,
} from './tools';
import type {
  AvailableModel,
  IntervalHandler,
  AgentControllerConfig,
  AgentControllerMode,
  AgentControllerRequestContext,
  AgentControllerRequestStateUpdater,
  AgentControllerSessionCreatedListener,
  AgentControllerSessionCreatedOptions,
  AgentControllerSessionDeletedListener,
  AgentControllerThread,
  ModelAuthStatus,
  ToolCategory,
} from './types';

/**
 * Registry key for the session map. JSON-encodes the (resourceId, scope) pair
 * so the key is collision-proof for arbitrary strings: a scoped session can
 * never collide with an unscoped one or with a different resource/scope split
 * (e.g. `("a\0b", "c")` vs `("a", "b\0c")`).
 */
function sessionRegistryKey(resourceId: string, scope?: string): string {
  return JSON.stringify([resourceId, scope ?? null]);
}

function validateModes(modes: AgentControllerMode[]): void {
  const modeIds = new Set<string>();

  for (const mode of modes) {
    if (modeIds.has(mode.id)) {
      throw new Error(`Duplicate mode id "${mode.id}" found when creating the AgentController`);
    }

    modeIds.add(mode.id);

    const modeRecord = mode as unknown as { id: string; tools?: unknown; additionalTools?: unknown };
    if (modeRecord.tools && modeRecord.additionalTools) {
      throw new Error(
        `Mode "${modeRecord.id}" cannot set both "tools" and "additionalTools" - choose replace OR augment`,
      );
    }
  }

  for (const mode of modes) {
    if (mode.transitionsTo === mode.id) {
      throw new Error(`Mode "${mode.id}" transitionsTo cannot reference itself`);
    }
    if (mode.transitionsTo && !modeIds.has(mode.transitionsTo)) {
      throw new Error(`Mode "${mode.id}" transitionsTo references unknown mode "${mode.transitionsTo}"`);
    }
  }
}

/**
 * Build a user-facing message for a non-success stream finish reason.
 *
 * Anthropic's classifier blocks / model refusals (e.g. `claude-fable-5`) surface
 * through the AI SDK as a `content-filter` finish reason, with details on
 * `providerMetadata.anthropic.stopDetails`. Without explicit handling these
 * runs end on an empty assistant message with no error, so the run appears to
 * silently stop. Returning a message here lets the controller finalize the run
 * into an explicit terminal error state.
 */
/**
 * The Anthropic model that `claude-fable-5` runs are automatically retried on
 * server-side when fable-5's safety classifiers block a turn. See
 * {@link buildFableFallbackProviderOptions}.
 */
const FABLE_FALLBACK_MODEL = 'claude-opus-4-8';

/**
 * Step budget applied to every controller-driven agent run.
 *
 * This MUST be passed to both the initial stream and `resumeStream`: when a run
 * suspends on an interactive tool (e.g. `ask_user`) and then resumes, the
 * resumed call merges over the agent's *default* options, whose `maxSteps` is
 * small (~5). Without re-supplying this budget the resumed run is silently
 * capped and ends with `reason:"complete"` after a few steps — the agent stops
 * mid-task even though it promised to continue. See {@link buildSharedRunOptions}.
 */
const CONTROLLER_MAX_STEPS = 1000;

/**
 * Returns Anthropic `providerOptions` that enable a server-side fallback to
 * {@link FABLE_FALLBACK_MODEL} when the active model is `claude-fable-5`, and
 * `undefined` otherwise.
 *
 * fable-5 can have a turn blocked server-side by its safety classifiers. With
 * a fallback configured, Anthropic transparently retries the blocked turn on
 * the fallback model and returns that model's answer instead of refusing. If
 * the whole chain refuses, the run still ends on a `content-filter` finish
 * reason, which is handled as a terminal error.
 *
 * The match is suffix-based so it covers `anthropic/claude-fable-5`, a bare
 * `claude-fable-5`, and any pack/provider-prefixed form.
 */
export function buildFableFallbackProviderOptions(
  modelId: string,
): { anthropic: { fallbacks: { model: string }[] } } | undefined {
  if (!/(^|\/)claude-fable-5$/.test(modelId)) {
    return undefined;
  }
  return { anthropic: { fallbacks: [{ model: FABLE_FALLBACK_MODEL }] } };
}

/**
 * Build a user-facing notice when a turn was served by an Anthropic
 * server-side fallback model instead of the primary model.
 *
 * When the primary model's safety classifiers decline a turn and a fallback
 * chain is configured (see {@link buildFableFallbackProviderOptions}), the API
 * transparently retries on the fallback model and reports this via
 * `fallback_message` entries in `providerMetadata.anthropic.iterations`.
 * Without a notice the user has no way to tell that the response did not come
 * from the model they selected.
 */

/** How much of the tail a rename reads: enough to say where the thread went, bounded so a long thread costs no more than a short one. */
const TITLE_WINDOW_MESSAGES = 20;

/**
 * The AgentController orchestrates multiple agent modes, shared state, memory, and storage.
 * It's the core abstraction that a TUI (or other UI) controls.
 *
 * @example
 * ```ts
 * const controller = new AgentController({
 *   id: "my-coding-agent",
 *   storage: new LibSQLStore({ url: "file:./data.db" }),
 *   stateSchema: z.object({
 *     currentModelId: z.string().optional(),
 *   }),
 *   modes: [
 *     { id: "plan", name: "Plan", default: true, agent: planAgent },
 *     { id: "build", name: "Build", agent: buildAgent },
 *   ],
 * })
 *
 * controller.subscribe((event) => {
 *   if (event.type === "message_update") renderMessage(event.message)
 * })
 *
 * await controller.init()
 * await controller.sendMessage({ content: "Hello!" })
 * ```
 */
export class AgentController<TState = {}> {
  readonly id: string;

  private config: AgentControllerConfig<TState>;
  private initPromise: Promise<void> | undefined = undefined;
  private browser: DynamicArgument<MastraBrowser | undefined> = undefined;
  private workspace: DynamicArgument<Workspace | undefined> = undefined;
  private intervalTimers = new Map<string, { timer: NodeJS.Timeout; shutdown?: () => void | Promise<void> }>();
  /**
   * The mode every new session starts in. Resolved once at construction from
   * `config.defaultModeId` (or the configured default/first mode) and reused by
   * every {@link createSession} call. The AgentController itself holds no session.
   */
  readonly #defaultMode: AgentControllerMode;
  /**
   * Live sessions created by {@link createSession}, keyed by resourceId plus an
   * optional caller-provided scope (see {@link sessionRegistryKey}). A
   * (resourceId, scope) pair maps to exactly one session per AgentController
   * (get-or-create). Stores the in-flight creation promise so concurrent calls
   * share one session. Lets AgentController-external callers (e.g. notification
   * delivery) resolve "the session that owns this resource" so a woken run uses
   * that session's model/mode/state instead of an arbitrary one.
   */
  readonly #sessionsByResource = new Map<string, Promise<Session<TState>>>();
  readonly #sessionCreatedListeners: Array<{
    listener: AgentControllerSessionCreatedListener<TState>;
    blocking: boolean;
  }> = [];
  readonly #sessionDeletedListeners: AgentControllerSessionDeletedListener<TState>[] = [];
  /**
   * In-progress deletions keyed by registry key, so {@link createSession} can
   * wait for a concurrent deletion to finish before returning a (torn-down)
   * session. Set synchronously before any await so the flag is visible to
   * concurrent callers.
   */
  readonly #deletionsInProgress = new Map<string, Promise<void>>();
  /**
   * Sessions currently being torn down, so {@link setResourceId} can refuse to
   * re-key a dying session and {@link createSession} can avoid returning one.
   * Populated inside the deletion IIFE after `await pending` resolves the
   * session.
   */
  readonly #sessionsBeingDeleted = new WeakSet<Session<TState>>();
  /**
   * Per-session deletion promise (rejection-tolerant), keyed by the Session
   * object so {@link createSession} and {@link setResourceId} can wait on a
   * deletion they discovered via {@link #sessionsBeingDeleted} without knowing
   * the original registry key.
   */
  readonly #sessionDeletionPromises = new WeakMap<Session<TState>, Promise<void>>();
  /**
   * The scope each live session was created under, so re-keying operations
   * (e.g. {@link setResourceId}) preserve the session's registry scope.
   */
  readonly #sessionScopes = new WeakMap<Session<TState>, string>();
  private availableModelsCache: AvailableModel[] | null = null;
  private availableModelsCacheTime: number = 0;
  readonly #instructions?: string;
  #internalMastra: Mastra | undefined = undefined;
  /**
   * Set when this AgentController is registered on a parent Mastra (via
   * {@link __registerMastra}). When present it is used in place of the
   * lazily-created internal Mastra, so a server-hosted AgentController shares the
   * server's storage/agents/gateways instead of spinning up its own.
   */
  #externalMastra: Mastra | undefined = undefined;
  #gatewayManager: GatewayManager | undefined = undefined;
  #legacyAgentMode: Record<string, Agent<any, any, any, any>> = {};
  /** Chat channels running this controller inside messaging threads (from `config.channels`). */
  #channels: AgentControllerChannels | null = null;

  constructor(config: AgentControllerConfig<TState>) {
    validateModes(config.modes);

    this.id = config.id;
    this.config = config;
    this.#instructions = config.instructions;
    if (config.channels) {
      this.#channels = new AgentControllerChannels(config.channels);
      this.#channels.__setController(this);
    }
    // Gateway manager merges configured gateways with the router defaults
    // (custom takes precedence). Shared by listAvailableModels,
    // getCurrentModelAuthStatus, and the OM model resolver.
    this.#gatewayManager = new GatewayManager([...(config.gateways ?? []), ...defaultGateways]);

    const defaultMode = config.defaultModeId
      ? config.modes.find(mode => mode.id === config.defaultModeId)
      : (config.modes.find(mode => mode.default || mode.metadata?.default === true) ?? config.modes[0]);
    if (!defaultMode) {
      throw new Error(
        config.defaultModeId
          ? `Default mode not found: ${config.defaultModeId}`
          : 'AgentController requires at least one agent mode',
      );
    }

    this.#defaultMode = defaultMode;

    this.workspace = config.workspace;
    this.browser = config.browser;
  }

  /**
   * Subscribe to process-local notifications for newly materialized sessions.
   * Cached `createSession()` calls do not notify listeners again.
   *
   * Async listeners are fire-and-forget by default. Pass `blocking: true` to
   * make `createSession()` await the listener before resolving — for setup that
   * must land before the caller can start a run (e.g. seeding session state
   * from storage). Blocking listeners run sequentially in registration order,
   * before fire-and-forget listeners are notified. Failures are isolated and
   * logged, never thrown — session creation stays best-effort with respect to
   * listener setup. A blocking listener must not call `createSession()` for
   * the same `(resourceId, scope)` it is initializing: that lookup awaits the
   * in-flight creation that is awaiting the listener, which deadlocks.
   */
  onSessionCreated(
    listener: AgentControllerSessionCreatedListener<TState>,
    options?: AgentControllerSessionCreatedOptions,
  ): () => void {
    const entry = { listener, blocking: options?.blocking === true };
    this.#sessionCreatedListeners.push(entry);
    return () => {
      const index = this.#sessionCreatedListeners.indexOf(entry);
      if (index !== -1) {
        this.#sessionCreatedListeners.splice(index, 1);
      }
    };
  }

  async #notifySessionCreated(session: Session<TState>): Promise<void> {
    const entries = [...this.#sessionCreatedListeners];
    // Blocking listeners complete sequentially, in registration order, before
    // fire-and-forget listeners can observe the session.
    for (const { listener, blocking } of entries) {
      if (!blocking) continue;
      try {
        await listener(session);
      } catch (error) {
        console.error('Error in session-created listener:', error);
      }
    }
    for (const { listener, blocking } of entries) {
      if (blocking) continue;
      try {
        const result = listener(session);
        if (result && typeof result === 'object' && 'catch' in result) {
          (result as Promise<void>).catch(error => console.error('Error in session-created listener:', error));
        }
      } catch (error) {
        console.error('Error in session-created listener:', error);
      }
    }
  }

  /**
   * Subscribe to process-local notifications after live sessions are torn
   * down. Fires even when teardown cleanup fails — the session is
   * deregistered either way.
   */
  onSessionDeleted(listener: AgentControllerSessionDeletedListener<TState>): () => void {
    this.#sessionDeletedListeners.push(listener);
    return () => {
      const index = this.#sessionDeletedListeners.indexOf(listener);
      if (index !== -1) {
        this.#sessionDeletedListeners.splice(index, 1);
      }
    };
  }

  #notifySessionDeleted(session: Session<TState>): void {
    for (const listener of [...this.#sessionDeletedListeners]) {
      try {
        const result = listener(session);
        if (result && typeof result === 'object' && 'catch' in result) {
          (result as Promise<void>).catch(error => console.error('Error in session-deleted listener:', error));
        }
      } catch (error) {
        console.error('Error in session-deleted listener:', error);
      }
    }
  }

  /**
   * Wire a freshly-constructed {@link Session} to this AgentController: install the
   * thread-settings store, resolvers (mode/model/om/permissions/subagents),
   * thread data store, and seed the initial mode + model. Returns the same
   * session for convenient assignment.
   *
   * The session owns its own event bus, so the AgentController no longer injects an
   * `emit` callback — `#wireSession` only injects genuinely AgentController-owned
   * dependencies (config catalog, resolvers, tracker, thread store). Extracted
   * from the constructor so additional sessions can be wired the same way.
   */
  #wireSession(session: Session<TState>): Session<TState> {
    const defaultMode = this.#defaultMode;
    session.mode.set({ modeId: defaultMode.id });
    session.setStore({
      get: key => session.thread.getSetting({ key }),
      set: (key, value) => session.thread.setSetting({ key, value }),
    });
    session.setCategoryResolver(toolName => this.getToolCategory({ toolName }));
    session.setSubagentNameResolver(agentType => this.getSubagentDisplayName(agentType));
    session.mode.setResolver(modeId => this.config.modes.find(m => m.id === modeId) ?? null);
    session.model.setResolver({
      getCurrentModeId: () => session.mode.get(),
      trackModelUse: this.config.modelUseCountTracker,
    });
    session.om.setResolver({
      getState: () => session.state.get() as Record<string, unknown>,
      setState: updates => void session.state.set(updates as Partial<TState>),
      setSetting: ({ key, value }) => session.thread.setSetting({ key, value }),
      omConfig: this.config.omConfig,
      gateways: this.config.gateways ?? [],
    });
    session.permissions.setResolver({
      getState: () => session.state.get() as Record<string, unknown>,
      setState: updates => session.state.set(updates as Partial<TState>),
    });
    session.subagents.setResolver({
      getState: () => session.state.get() as Record<string, unknown>,
      setState: updates => void session.state.set(updates as Partial<TState>),
      setSetting: ({ key, value }) => session.thread.setSetting({ key, value }),
    });
    session.thread.connect(this.createThreadDataStore(session), session as Session);
    session.setMachinery({
      getAgent: () => this.getCurrentAgent(session),
      subscribeToThread: ({ resourceId, threadId }) =>
        this.getCurrentAgent(session).subscribeToThread({ resourceId, threadId }),
      buildStreamOptions: input => this.buildAgentMessageStreamOptions({ session, ...input }),
      buildSharedRunOptions: () => this.buildSharedRunOptions(session),
      buildToolsets: requestContext => this.buildToolsets(session, requestContext),
      buildRequestContext: requestContext => this.buildRequestContext(session, requestContext),
      persistTokenUsage: () => this.persistTokenUsage(session),
      generateId: () => this.generateId(),
      resolveTransitionModeId: () => this.resolveTransitionModeId(session),
      saveSystemReminder: input => this.saveSystemReminder(input),
    });

    // Seed the selected model: an explicit initialState.currentModelId wins,
    // otherwise fall back to the default mode's model. The model lives on the
    // session, not in persisted state, so initialState.currentModelId is read
    // here as a construction-time input only.
    const initialModelId = (this.config.initialState as { currentModelId?: string } | undefined)?.currentModelId;
    if (initialModelId) {
      session.model.set({ modelId: initialModelId });
    } else if (defaultMode.defaultModelId) {
      session.model.set({ modelId: defaultMode.defaultModelId });
    }

    return session;
  }

  /**
   * Create a new, fully-wired {@link Session} and bring it online: it starts in
   * the default mode with the seeded model, is connected to the AgentController's shared
   * machinery (agent, storage/lock, config catalog), and has a current thread
   * (the most recent thread for `resourceId`, or a freshly created one).
   *
   * The AgentController owns no session of its own — every consumer creates its own
   * session and drives all work through it (`session.sendMessage`,
   * `session.mode.switch`, `session.thread.*`, `session.subscribe`, ...). In a
   * server / multiplayer setting, each request / thread / user gets its own
   * session, isolated from every other: independent event bus, mode, model,
   * state, and current thread.
   *
   * Call {@link init} once before creating sessions so shared storage and
   * workspace are ready.
   *
   * @param id - Stable session identifier (mirrors `SessionRecord.id`). Defaults to the controller `id`.
   * @param ownerId - Stable session owner (mirrors `SessionRecord.ownerId`). Defaults to the controller `id`.
   * @param resourceId - Memory resource to bind this session to. Defaults to the controller `resourceId` or `id`.
   */
  async createSession({
    resourceId,
    ownerId,
    id,
    scope,
    tags,
    threadId,
    workspace,
    browser,
    requestContext,
  }: {
    resourceId?: string;
    id?: string;
    ownerId?: string;
    /**
     * Optional isolation scope within a resourceId. Two `createSession` calls
     * with the same resourceId but different scopes get two independent
     * sessions (own run loop, thread binding, mode/model/state) instead of
     * resolving to the same one. Memory/threads still belong to the shared
     * resourceId. Used by hosts that run parallel sessions over one resource —
     * e.g. one session per git worktree, with the worktree path as the scope.
     */
    scope?: string;
    /**
     * Arbitrary string tags that scope this session. Each tag is seeded into the
     * session's state and used to filter initial thread selection: a thread is a
     * resume candidate only when its metadata matches every provided tag. This
     * lets worktrees sharing a resourceId each resume their own thread (via a
     * `projectPath` tag) and leaves room for future scoping dimensions without
     * changing the API. Falls back to `initialState` when omitted.
     */
    tags?: Record<string, string>;
    /** Exact thread id to bind during session creation. Existing threads are resumed; missing threads are created with this id. */
    threadId?: string;
    workspace?: Workspace;
    browser?: MastraBrowser;
    requestContext?: RequestContext;
  } = {}): Promise<Session<TState>> {
    const effectiveResourceId = resourceId ?? this.config.resourceId ?? this.config.id;
    const effectiveSessionId = id ?? this.config.id;
    const effectiveOwnerId = ownerId ?? this.config.id;
    const registryKey = sessionRegistryKey(effectiveResourceId, scope);

    // Get-or-create loop: a (resourceId, scope) pair maps to exactly one
    // durable session per AgentController. Asking for the same resource+scope
    // twice returns the same session, so a user/thread always resumes their own
    // session and notification delivery reuses it rather than spawning a
    // split-brain duplicate. Cache the in-flight promise so concurrent calls
    // for the same resource+scope resolve to one session.
    //
    // The loop also serializes against concurrent deleteSession: if a deletion
    // is in progress (or starts during an await), wait for it to finish, then
    // retry so the caller gets a fresh session instead of a torn-down one.
    for (;;) {
      // Wait for any in-progress deletion before looking up the registry.
      let pendingDeletion = this.#deletionsInProgress.get(registryKey);
      if (pendingDeletion) await pendingDeletion;

      const existing = this.#sessionsByResource.get(registryKey);
      if (existing) {
        const session = await existing;
        // A deletion may have started during the await — either for this key
        // (tracked in #deletionsInProgress) or for a previous key if
        // setResourceId re-registered the session (tracked in
        // #sessionsBeingDeleted + #sessionDeletionPromises).
        pendingDeletion = this.#deletionsInProgress.get(registryKey);
        if (pendingDeletion) {
          await pendingDeletion;
          continue;
        }
        if (this.#sessionsBeingDeleted.has(session)) {
          const sessionDeletion = this.#sessionDeletionPromises.get(session);
          if (sessionDeletion) await sessionDeletion;
          // Evict the dead session's registry entry so the retry finds a
          // fresh slot instead of the same dead session forever.
          this.#sessionsByResource.delete(registryKey);
          continue;
        }
        // An exact thread binding is part of the createSession contract
        // ("existing threads are resumed; missing threads are created with this
        // id"), so honor it on cached sessions too. Without this, whichever
        // request creates the session first wins: a thread-agnostic caller (SSE
        // subscribe, message listing) racing ahead of an exact-thread create
        // would leave the session bound to a different thread and the requested
        // thread never created.
        if (threadId && session.thread.getId() !== threadId) {
          const existingThread = await session.thread.getById({ threadId });
          if (existingThread) {
            if (existingThread.resourceId !== effectiveResourceId) {
              throw new Error(`Thread not found: ${threadId}`);
            }
            await session.thread.switch({ threadId });
          } else {
            await session.thread.create({ id: threadId });
          }
        }
        // A deletion may have started during the thread-rebinding awaits.
        pendingDeletion = this.#deletionsInProgress.get(registryKey);
        if (pendingDeletion) {
          await pendingDeletion;
          continue;
        }
        if (this.#sessionsBeingDeleted.has(session)) {
          const sessionDeletion = this.#sessionDeletionPromises.get(session);
          if (sessionDeletion) await sessionDeletion;
          // Evict the dead session's registry entry so the retry finds a
          // fresh slot instead of the same dead session forever.
          this.#sessionsByResource.delete(registryKey);
          continue;
        }
        return session;
      }

      const creation = this.#createSessionForResource(effectiveOwnerId, effectiveSessionId, effectiveResourceId, tags, {
        scope,
        threadId,
        workspace,
        browser,
        requestContext,
      });
      this.#sessionsByResource.set(registryKey, creation);
      try {
        const session = await creation;
        // A deletion may have started during creation.
        pendingDeletion = this.#deletionsInProgress.get(registryKey);
        if (pendingDeletion) {
          await pendingDeletion;
          continue;
        }
        if (scope !== undefined) this.#sessionScopes.set(session, scope);
        return session;
      } catch (error) {
        // Don't cache a failed creation — let the next call retry.
        if (this.#sessionsByResource.get(registryKey) === creation) {
          this.#sessionsByResource.delete(registryKey);
        }
        throw error;
      }
    }
  }

  async #createSessionForResource(
    ownerId: string,
    id: string,
    effectiveResourceId: string,
    tags?: Record<string, string>,
    overrides?: {
      scope?: string;
      threadId?: string;
      workspace?: Workspace;
      browser?: MastraBrowser;
      requestContext?: RequestContext;
    },
  ): Promise<Session<TState>> {
    // Seed the session's tags into its state so thread tagging + the workspace
    // factory resolve against this session's scope (e.g. its `projectPath`), not
    // the controller-global default (which, on a multi-session server, may point at
    // a different repo).
    const requestContext = overrides?.requestContext ?? new RequestContext();
    let initialState = structuredClone(this.config.initialState);
    if (tags && Object.keys(tags).length > 0) {
      initialState = { ...initialState, ...tags } as TState;
    }
    const defaultMode = this.#defaultMode;
    requestContext.set('controller', {
      controllerId: this.id,
      harnessId: this.id,
      state: initialState,
      getState: () => initialState,
      setState: (updates: Partial<TState>) => {
        initialState = { ...initialState, ...updates };
      },
      updateState: (updater: AgentControllerRequestStateUpdater<TState, unknown>) => {
        return Promise.resolve(updater(initialState as Readonly<TState>)).then(result => {
          if (result.updates) {
            initialState = { ...initialState, ...result.updates };
          }
          return result.result;
        });
      },
      threadId: null,
      resourceId: effectiveResourceId,
      scope: overrides?.scope,
      session: {
        id,
        ownerId,
        resourceId: effectiveResourceId,
        modeId: defaultMode.id,
        modelId: defaultMode.defaultModelId ?? '',
        state: {
          get: () => initialState as Readonly<TState>,
          set: (updates: Partial<TState>) => {
            initialState = { ...initialState, ...updates };
            return Promise.resolve();
          },
          update: <TResult>(updater: AgentControllerRequestStateUpdater<TState, TResult>) => {
            return Promise.resolve(updater(initialState as Readonly<TState>)).then(result => {
              if (result.updates) {
                initialState = { ...initialState, ...result.updates };
              }
              return result.result;
            });
          },
        },
      },
      getSubagentModelId: (params?: { agentType?: string }) => {
        const sub = this.config.subagents?.find(s => s.id === params?.agentType);
        return sub?.defaultModelId ?? null;
      },
    });

    let workspaceToConnect = overrides?.workspace ?? this.workspace;
    if (typeof workspaceToConnect === 'function') {
      workspaceToConnect = await workspaceToConnect({ requestContext, mastra: this.getMastra() });
    }

    let browserToConnect = overrides?.browser ?? this.browser;
    if (typeof browserToConnect === 'function') {
      browserToConnect = await browserToConnect({ requestContext, mastra: this.getMastra() });
    }

    const session = this.#wireSession(
      new Session({
        resourceId: effectiveResourceId,
        id,
        ownerId,
        tags,
        state: {
          initialState,
          stateSchema: this.config.stateSchema,
        },
        workspace: workspaceToConnect,
        browser: browserToConnect,
      }),
    );

    if (overrides?.threadId) {
      const existingThread = await session.thread.getById({ threadId: overrides.threadId });
      if (existingThread) {
        if (existingThread.resourceId !== effectiveResourceId) {
          throw new Error(`Thread not found: ${overrides.threadId}`);
        }
        await this.config.threadLock?.acquire(existingThread.id);
        session.thread.set({ threadId: existingThread.id });
        await session.thread.loadMetadata();
        await session.thread.ensureCurrentSubscription();
      } else {
        await session.thread.create({ id: overrides.threadId });
      }
    } else {
      // Same scope `thread.create()` stamps, matched strictly: a thread outside
      // this session's scope — including one carrying no scope at all — belongs
      // to nobody here and must not be auto-resumed.
      const scopeEntries = Object.entries(session.getThreadScope());

      const threads = await session.thread.list();
      const candidates = threads.filter(t => {
        const metadata = (t.metadata as Record<string, unknown> | undefined) ?? {};
        return scopeEntries.every(([key, value]) => metadata[key] === value);
      });

      if (candidates.length === 0) {
        await session.thread.create();
      } else {
        const mostRecent = [...candidates].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]!;
        await this.config.threadLock?.acquire(mostRecent.id);
        session.thread.set({ threadId: mostRecent.id });
        await session.thread.loadMetadata();
        await session.thread.ensureCurrentSubscription();
      }
    }

    await this.#notifySessionCreated(session);
    return session;
  }

  /**
   * Resolve a live session by resourceId (and optional scope), if one was
   * created for it via {@link createSession}. Returns `undefined` when no
   * session owns the resource. Used by notification delivery to run woken
   * signals as the session that owns the target thread, rather than an
   * arbitrary session.
   */
  async getSessionByResource(resourceId: string, scope?: string): Promise<Session<TState> | undefined> {
    return this.#sessionsByResource.get(sessionRegistryKey(resourceId, scope));
  }

  /**
   * Tear down the live session registered for a resource and optional scope.
   * This only removes runtime state; persisted threads and messages remain.
   * Returns `false` when no live session is registered.
   */
  async deleteSession({ resourceId, scope }: { resourceId: string; scope?: string }): Promise<boolean> {
    const registryKey = sessionRegistryKey(resourceId, scope);

    // Don't start a second deletion for the same key.
    if (this.#deletionsInProgress.has(registryKey)) return false;

    const pending = this.#sessionsByResource.get(registryKey);
    if (!pending) return false;

    // Track the deletion by registry key and set it synchronously, before any
    // await, so a concurrent createSession that resumes from `await existing`
    // sees the flag and waits instead of returning a session being torn down.
    const deletion: { tolerantPromise?: Promise<void> } = {};
    const deletionPromise = (async () => {
      const session = await pending;
      this.#sessionsBeingDeleted.add(session);
      // tolerantPromise is set synchronously below before this microtask runs.
      this.#sessionDeletionPromises.set(session, deletion.tolerantPromise!);
      session.abort();
      session.thread.cleanupSubscription();
      try {
        await session.thread.clearAndReleaseLock();
      } finally {
        // Notify inside the finally: even when lock release fails the session
        // is deregistered for good, and listeners mirror the registry.
        await this.#dropSessionFromRegistry(registryKey, session);
        this.#notifySessionDeleted(session);
      }
    })();
    // Waiters only need to know when teardown finished, not why it failed.
    // Without this, a clearAndReleaseLock rejection would propagate to every
    // createSession caller that happened to await the in-progress deletion.
    const tolerantPromise = deletionPromise.then(
      () => undefined,
      () => undefined,
    );
    deletion.tolerantPromise = tolerantPromise;
    this.#deletionsInProgress.set(registryKey, tolerantPromise);
    try {
      await deletionPromise;
      return true;
    } finally {
      this.#deletionsInProgress.delete(registryKey);
    }
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Access the Mastra instance backing this AgentController.
   *
   * Returns the parent Mastra when this AgentController is registered on one (see
   * {@link __registerMastra}); otherwise the internal Mastra created during
   * `init()` when storage is configured.
   *
   * Useful for scorer registration, observability access, and eval tooling.
   */
  getMastra(): Mastra | undefined {
    return this.#externalMastra ?? this.#internalMastra;
  }

  /**
   * Whether a workspace is configured on this AgentController (static instance, dynamic
   * factory, or config object). Sessions without an explicit workspace override
   * fall back to this.
   */
  hasWorkspace(): boolean {
    return this.workspace !== undefined;
  }

  /**
   * Whether the AgentController-level static workspace has been explicitly initialized.
   * Dynamic factory workspaces have no controller-level readiness state.
   */
  isWorkspaceReady(): boolean {
    if (typeof this.workspace === 'function') return true;
    return this.workspace?.status === 'ready';
  }

  /**
   * The AgentController-level workspace, if it is a static instance. Dynamic factory
   * workspaces are not resolved here — use {@link resolveWorkspace} to resolve
   * a factory against a session's request context.
   */
  getWorkspace(): Workspace | undefined {
    return typeof this.workspace === 'function' ? undefined : (this.workspace ?? undefined);
  }

  /**
   * The workspace this session runs against, for code paths outside the request
   * flow (e.g. slash commands). Sessions resolve their workspace once at
   * creation — dynamic factories included — so this returns that instance
   * rather than re-resolving, and only falls back to the factory for a session
   * created without one.
   */
  async resolveWorkspace({
    session,
    requestContext,
  }: {
    session: Session<TState>;
    requestContext?: RequestContext;
  }): Promise<Workspace | undefined> {
    const sessionWorkspace = session.getWorkspace();
    if (sessionWorkspace) return sessionWorkspace;
    if (typeof this.workspace !== 'function') return this.workspace ?? undefined;
    const ctx = await this.buildRequestContext(session, requestContext);
    return (await this.workspace({ requestContext: ctx, mastra: this.getMastra() })) ?? undefined;
  }

  /**
   * Register this AgentController on a parent Mastra. Called by Mastra during
   * construction when a harness is passed in its config. Once registered, the
   * AgentController uses the parent Mastra (its storage, agents, gateways, and
   * observability) instead of building its own internal one during `init()`.
   *
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.#externalMastra = mastra;

    // If `init()` already built an internal Mastra before we were wired to a
    // parent, drop it: the parent now owns storage/agents/observability, but the
    // orphaned internal instance still holds a global scorer hook that fires
    // (and fails to resolve the scorer) on every scorer run. Release it.
    if (this.#internalMastra) {
      this.#internalMastra.__unregisterHooks();
      this.#internalMastra = undefined;
    }
  }

  /**
   * Resolve the storage this AgentController reads and writes through.
   *
   * When registered on a parent Mastra, the AgentController inherits that Mastra's
   * configured storage so the host and its Harnesses persist to a single store.
   * A standalone AgentController falls back to its own `config.storage`.
   */
  #resolveStorage(): MastraCompositeStore | undefined {
    return this.#externalMastra?.getStorage() ?? this.config.storage;
  }

  /**
   * Sets or updates the harness-level browser and propagates it to mode agents.
   */
  setBrowser(browser: MastraBrowser | undefined): void {
    this.browser = browser;

    for (const agent of this.backingAgents()) {
      agent.setBrowser(browser);
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the harness by loading storage and propagating runtime services.
   * Workspaces initialize lazily when used. Must be called before using the harness. Idempotent: repeated calls
   * return the same in-flight/completed initialization instead of rebuilding
   * the internal Mastra instance (which would orphan registered agents).
   */
  async init(): Promise<void> {
    this.initPromise ??= this.runInit();
    return this.initPromise;
  }

  /**
   * Initialize only what read-only queries need: the storage layer (either a
   * fresh internal Mastra wrapping the configured storage, or the inherited
   * parent Mastra's storage). Skips workspace/sandbox provisioning entirely.
   *
   * Idempotent and safe to call from every read query; the underlying
   * MastraCompositeStore init dedupes.
   */
  async initStorage(): Promise<void> {
    this.#storageInitPromise ??= this.runStorageInit();
    return this.#storageInitPromise;
  }

  #storageInitPromise?: Promise<void>;

  private async runStorageInit(): Promise<void> {
    // Create an internal Mastra instance so agents have access to storage
    // (required for tool approval snapshot persistence/resume).
    // We init storage through Mastra's proxied storage so augmentWithInit
    // tracks it and won't double-init.
    //
    // Skip this when registered on a parent Mastra: that Mastra already owns
    // storage/agents/gateways, and getMastra() resolves to it.
    if (this.config.storage && !this.#externalMastra) {
      const enabledGateways = this.config.gateways?.filter(gateway => gateway.shouldEnable?.() ?? true);
      const gateways = enabledGateways?.length
        ? Object.fromEntries(enabledGateways.map(gateway => [gateway.id, gateway]))
        : undefined;

      this.#internalMastra = new Mastra({
        logger: false,
        storage: this.config.storage,
        ...(this.config.pubsub ? { pubsub: this.config.pubsub } : {}),
        ...(this.config.observability ? { observability: this.config.observability } : {}),
        ...(gateways ? { gateways } : {}),
      });
      await this.#internalMastra.getStorage()!.init();
    } else if (this.#externalMastra) {
      // Registered on a parent Mastra: don't build an internal Mastra, but make
      // sure the inherited storage is initialized before any session reads or
      // writes through it. Init is idempotent on MastraCompositeStore, so this
      // is safe even when the parent already initialized it.
      await this.#externalMastra.getStorage()?.init();
    }
  }

  private async runInit(): Promise<void> {
    await this.initStorage();

    // Propagate harness-level Mastra, memory, workspace, browser, and pubsub
    // to the agent(s) that back each mode. Workspaces initialize lazily when used.
    for (const agent of this.backingAgents()) {
      this.propagateRuntimeServicesToAgent(agent);
    }

    this.startIntervals();
  }

  private async getMemoryStorage(): Promise<MemoryStorage> {
    const storage = this.#resolveStorage();
    if (!storage) {
      throw new Error('Storage is not configured on this AgentController');
    }
    const memoryStorage = await storage.getStore('memory');
    if (!memoryStorage) {
      throw new Error('Storage does not have a memory domain configured');
    }
    return memoryStorage;
  }

  /**
   * The shared-host storage gateway the Session's thread domain reads/writes
   * through. The Session owns the thread-domain logic; this adapter maps raw
   * storage rows to AgentController types and uses the active session only when
   * resolving configured memory for a clone.
   */
  private createThreadDataStore(session: Session<TState>): ThreadDataStore {
    return {
      listThreads: ({ resourceId, includeForkedSubagents, metadata }) =>
        this.queryThreads({ resourceId, includeForkedSubagents, metadata }),
      getById: ({ threadId }) => this.queryThreadById({ threadId }),
      listMessages: ({ threadId, limit }) => this.queryThreadMessages({ threadId, limit }),
      firstUserMessages: ({ threadIds }) => this.queryFirstUserMessages({ threadIds }),
      getMetadata: ({ threadId, key }) => this.readThreadMetadataValue({ threadId, key }),
      setMetadata: ({ threadId, key, value }) => this.writeThreadMetadataValue({ threadId, key, value }),
      deleteMetadata: ({ threadId, key }) => this.removeThreadMetadataValue({ threadId, key }),
      hasStorage: () => !!this.#resolveStorage(),
      saveThread: ({ thread }) => this.persistThreadRow(thread),
      deleteThread: ({ threadId }) => this.deleteThreadRow(threadId),
      cloneThread: ({ sourceThreadId, resourceId, title, metadata }) =>
        this.cloneThreadRow({ session, sourceThreadId, resourceId, title, metadata }),
      acquireLock: threadId => this.config.threadLock?.acquire(threadId) ?? Promise.resolve(),
      releaseLock: threadId => this.config.threadLock?.release(threadId) ?? Promise.resolve(),
      getModeIds: () => this.config.modes.map(m => m.id),
    };
  }

  /** Persist a thread row to memory storage (gateway primitive for the Session thread domain). */
  private async persistThreadRow(thread: AgentControllerThread): Promise<void> {
    if (!this.#resolveStorage()) return;
    const memoryStorage = await this.getMemoryStorage();
    await memoryStorage.saveThread({
      thread: {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title ?? '',
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
      },
    });
  }

  /** Delete a thread row from memory storage (gateway primitive for the Session thread domain). */
  private async deleteThreadRow(threadId: string): Promise<void> {
    if (!this.#resolveStorage()) return;
    const memoryStorage = await this.getMemoryStorage();
    await memoryStorage.deleteThread({ threadId });
  }

  /** Clone a thread (and messages) via the host's memory (gateway primitive for the Session thread domain). */
  private async cloneThreadRow({
    session,
    sourceThreadId,
    resourceId,
    title,
    metadata,
  }: {
    session: Session<TState>;
    sourceThreadId: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentControllerThread> {
    const storage = this.#resolveStorage();
    const memory = this.config.memory
      ? await this.resolveMemory(session)
      : storage
        ? await storage.getStore('memory')
        : undefined;
    if (!memory) {
      throw new Error(
        storage ? 'Storage does not have a memory domain configured' : 'Memory is not configured on this Harness',
      );
    }

    const result = await memory.cloneThread({ sourceThreadId, resourceId, title, metadata });
    return {
      id: result.thread.id,
      resourceId: result.thread.resourceId,
      title: result.thread.title ?? 'Cloned Thread',
      createdAt: result.thread.createdAt,
      updatedAt: result.thread.updatedAt,
      metadata: result.thread.metadata,
    };
  }

  private async readThreadMetadataValue({ threadId, key }: { threadId: string; key: string }): Promise<unknown> {
    if (!this.#resolveStorage()) return undefined;
    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      const metadata = thread?.metadata as Record<string, unknown> | undefined;
      return metadata?.[key];
    } catch {
      // Settings reads are not critical
      return undefined;
    }
  }

  private async writeThreadMetadataValue({
    threadId,
    key,
    value,
  }: {
    threadId: string;
    key: string;
    value: unknown;
  }): Promise<void> {
    if (!this.#resolveStorage()) return;
    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (thread) {
        await memoryStorage.saveThread({
          thread: { ...thread, metadata: { ...thread.metadata, [key]: value }, updatedAt: new Date() },
        });
      }
    } catch {
      // Settings persistence is not critical
    }
  }

  private async removeThreadMetadataValue({ threadId, key }: { threadId: string; key: string }): Promise<void> {
    if (!this.#resolveStorage()) return;
    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (thread && thread.metadata) {
        const metadata = { ...thread.metadata };
        delete metadata[key];
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Settings removal is not critical
    }
  }

  /**
   * Read a single thread by id directly from storage, without constructing a
   * {@link Session}. Read-only server endpoints use this so a GET request for a
   * thread doesn't spin up a workspace/sandbox as a side effect of session
   * creation. Returns `null` when the thread doesn't exist or no storage is
   * configured.
   */
  async queryThreadById({ threadId }: { threadId: string }): Promise<AgentControllerThread | null> {
    await this.initStorage();
    if (!this.#resolveStorage()) return null;
    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
    if (!thread) return null;
    return {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    };
  }

  /**
   * List threads directly from storage, without constructing a {@link Session}.
   * Read-only server endpoints use this so a GET on `/threads` doesn't spin up
   * a workspace/sandbox as a side effect of session creation.
   */
  async queryThreads({
    resourceId,
    includeForkedSubagents,
    metadata,
  }: {
    resourceId?: string;
    includeForkedSubagents?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<AgentControllerThread[]> {
    await this.initStorage();
    if (!this.#resolveStorage()) {
      return [];
    }

    const memoryStorage = await this.getMemoryStorage();
    const filter =
      resourceId === undefined && metadata === undefined
        ? undefined
        : {
            ...(resourceId === undefined ? {} : { resourceId }),
            ...(metadata === undefined ? {} : { metadata }),
          };

    const result = await memoryStorage.listThreads({ filter, perPage: false });

    const threads = includeForkedSubagents
      ? result.threads
      : result.threads.filter(thread => {
          const metadata = thread.metadata as Record<string, unknown> | undefined;
          return metadata?.forkedSubagent !== true;
        });

    return threads.map((thread: StorageThreadType) => ({
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    }));
  }

  /**
   * List messages for a thread directly from storage, without constructing a
   * {@link Session}. Read-only server endpoints use this so a GET on a thread's
   * messages doesn't spin up a workspace/sandbox as a side effect of session
   * creation.
   */
  async queryThreadMessages({ threadId, limit }: { threadId: string; limit?: number }): Promise<MastraDBMessage[]> {
    await this.initStorage();
    if (!this.#resolveStorage()) return [];

    const memoryStorage = await this.getMemoryStorage();

    if (limit) {
      const result = await memoryStorage.listMessages({
        threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages.map(msg => this.convertToControllerMessage(msg)).reverse();
    }

    const result = await memoryStorage.listMessages({ threadId, perPage: false });
    return result.messages.map(msg => this.convertToControllerMessage(msg));
  }

  private async queryFirstUserMessages({ threadIds }: { threadIds: string[] }): Promise<Map<string, MastraDBMessage>> {
    if (!this.#resolveStorage() || threadIds.length === 0) return new Map();

    const memoryStorage = await this.getMemoryStorage();
    const result = await memoryStorage.listMessages({
      threadId: threadIds,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    const firstUserMessages = new Map<string, MastraDBMessage>();
    for (const message of result.messages) {
      if (!isUserAuthoredMessage(message) || !message.threadId || firstUserMessages.has(message.threadId)) continue;
      firstUserMessages.set(message.threadId, this.convertToControllerMessage(message));

      if (firstUserMessages.size === threadIds.length) {
        break;
      }
    }

    return firstUserMessages;
  }

  /**
   * Name a thread from where its conversation went, with the model and
   * instructions `generateTitle` gives the first-turn namer — so a title asked
   * for by hand reads like one the thread would have been given on its own.
   *
   * Runs without constructing a {@link Session}: naming reads a window of recent
   * messages and writes the thread row, so asking for a title never spins up a
   * workspace or sandbox. A session already live for the resource lends its agent, request
   * context and event stream; otherwise the default mode answers — and with no
   * session state to read, a `generateTitle.model` that resolves from it falls
   * back to its own default, which is why hosts that store the choice elsewhere
   * pass `model`. Resolves to the new title, or `undefined` when the model
   * returns nothing and the current title stands.
   */
  async generateThreadTitle({
    threadId,
    resourceId,
    scope,
    model,
    requestContext: callerContext,
  }: {
    threadId: string;
    resourceId?: string;
    scope?: string;
    /** Overrides the memory-configured title model — for hosts that resolve it themselves. */
    model?: DynamicArgument<MastraModelConfig>;
    /** The caller's context — carries the identity model resolution bills to. */
    requestContext?: RequestContext;
  }): Promise<string | undefined> {
    const thread = await this.queryThreadById({ threadId });
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const recent = await this.queryThreadMessages({ threadId, limit: TITLE_WINDOW_MESSAGES });
    const messages = new MessageList().add(recent, 'memory').get.all.ui();
    if (!messages.some(message => message.role === 'user')) {
      throw new Error('This conversation has no message to name it from yet.');
    }

    const session = resourceId ? await this.getSessionByResource(resourceId, scope) : undefined;
    const agent = session
      ? this.getCurrentAgent(session)
      : this.propagateRuntimeServicesToAgent(this.getAgentForMode(this.#defaultMode));
    const requestContext = session
      ? await this.buildRequestContext(session, callerContext)
      : (callerContext ?? new RequestContext());
    const configured = (await agent.getMemory({ requestContext }))?.getMergedThreadConfig().generateTitle;
    const titleConfig = typeof configured === 'object' ? configured : undefined;

    const title = (
      await agent.generateTitleFromUserMessage({
        messages,
        requestContext,
        model: model ?? titleConfig?.model,
        instructions: titleConfig?.instructions,
      })
    )?.trim();
    if (!title) return undefined;

    await this.persistThreadRow({ ...thread, title, updatedAt: new Date() });
    session?.emit({ type: 'thread_title_updated', threadId, title });
    return title;
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  listModes(): AgentControllerMode[] {
    return this.config.modes;
  }

  private propagateRuntimeServicesToAgent(agent: Agent, _session?: Session<TState>): Agent {
    if (this.config.memory && !agent.hasOwnMemory()) {
      agent.__setMemory(this.config.memory);
    }
    if (this.config.pubsub && !agent.hasOwnPubSub()) {
      agent.__setPubSub(this.config.pubsub);
    }

    // Register the agent on the resolved Mastra (the parent when registered,
    // otherwise the internal one). Re-bind when the agent currently has no
    // Mastra OR is bound to a different instance — e.g. an agent that built its
    // own internal Mastra before this AgentController was registered on a parent.
    // Done before workspace/browser propagation so that addAgent — which may
    // resolve agent.getWorkspace() — does not prematurely invoke a workspace
    // factory before the per-session request context is available.
    const mastra = this.getMastra();
    if (mastra && agent.getMastraInstance() !== mastra) {
      mastra.addAgent(agent);
    }

    if (this.workspace && typeof agent.hasOwnWorkspace === 'function' && !agent.hasOwnWorkspace()) {
      agent.__setWorkspace(this.workspace);
    }
    if (
      this.browser &&
      typeof agent.hasOwnBrowser === 'function' &&
      !agent.hasOwnBrowser() &&
      typeof this.browser !== 'function'
    ) {
      agent.setBrowser(this.browser);
    }

    // Propagate controller channels onto the resolved (possibly lazily-built)
    // mode agent so its run renders back through the controller's adapters.
    // Unconditional: a controller's mode agents never carry their own channels,
    // and `Agent.setChannels` is idempotent for the same instance. There is no
    // `hasOwnChannels()` guard equivalent to `hasOwnBrowser()`.
    if (this.#channels && agent.getChannels() !== this.#channels) {
      agent.setChannels(this.#channels);
    }

    return agent;
  }

  /**
   * Chat channels configured on this controller (from `config.channels`),
   * or null when the controller has no channels.
   */
  getChannels(): AgentControllerChannels | null {
    return this.#channels;
  }

  /**
   * Sets the AgentControllerChannels instance for this controller and
   * propagates it onto every backing agent so their runs render back through
   * the controller's adapters. Used by ChannelProvider implementations (e.g.
   * SlackProvider) to inject channels they create for dynamic installations.
   * Mirrors {@link setBrowser}: the instance is attached to the shared backing
   * agent plus any per-mode agents via `Agent.setChannels`, and lazily-built
   * mode agents pick it up on their first run via
   * `propagateRuntimeServicesToAgent`.
   *
   * Replacing an existing instance is expected on provider reconnect (the
   * provider rebuilds channels as a superset merge rather than mutating the
   * live instance), so it logs at debug level only. Note the replaced
   * instance's in-memory `autoApproveResourceIds` tracking is discarded with
   * it — harmless, since it is refreshed on every inbound message.
   * @internal
   */
  setChannels(channels: AgentControllerChannels): void {
    if (this.#channels && this.#channels !== channels) {
      this.getMastra()?.getLogger()?.debug(`[AgentController:${this.id}] Replacing existing AgentControllerChannels`);
    }
    this.#channels = channels;
    channels.__setController(this);

    for (const agent of this.backingAgents()) {
      agent.setChannels(channels);
    }
  }

  /** The distinct agents backing this controller: the shared one plus any deprecated per-mode agent. */
  private backingAgents(): Set<Agent<any, any, any, any>> {
    const agents = new Set<Agent<any, any, any, any>>();
    if (this.config.agent) {
      agents.add(this.config.agent);
    }
    for (const mode of this.config.modes) {
      if (mode.agent || !this.config.agent) {
        agents.add(this.getAgentForMode(mode));
      }
    }
    return agents;
  }

  private getAgentForMode(mode: AgentControllerMode): Agent<any, any, any, any> {
    // Deprecated per-mode agent — use directly, no forking.
    if (mode.agent) {
      if (!this.#legacyAgentMode[mode.id]) {
        this.#legacyAgentMode[mode.id] = mode.agent;
      }
      return this.#legacyAgentMode[mode.id]!;
    }

    // Shared backing agent — reuse the single instance.
    // The harness never mutates the agent's own instructions or tools.
    // Mode instructions are passed at call time via buildAgentMessageStreamOptions;
    // mode tools are resolved at execution time via buildToolsets.
    if (this.config.agent) {
      return this.config.agent;
    }

    // No backing agent — construct one per mode (cached).
    if (!this.#legacyAgentMode[mode.id]) {
      if (!mode.defaultModelId) {
        throw new Error(`Mode ${mode.id} requires a defaultModelId when no backing agent is configured`);
      }

      const instructions = [this.#instructions ?? '', mode.instructions].filter(Boolean).join('\n');
      const modeTools = {
        ...mode.tools,
        ...mode.additionalTools,
      };

      // Model resolution flows through the gateways registered on the internal
      // Mastra instance: the bare model id string is handed to the Agent, and
      // `propagateRuntimeServicesToAgent` attaches the internal Mastra so the
      // model router resolves it via the configured gateways (auth included).
      const model = mode.defaultModelId;
      this.#legacyAgentMode[mode.id] = new Agent({
        id: `${this.id}-agent`,
        name: `Harness ${this.id} agent`,
        model,
        instructions,
        tools: modeTools,
      });
    }
    return this.#legacyAgentMode[mode.id]!;
  }

  /**
   * Resolve the combined instructions for the current mode: harness-level
   * instructions + mode-specific instructions. Passed at call time via
   * `buildAgentMessageStreamOptions` so the agent's own instructions are
   * never mutated.
   */
  private resolveCurrentModeInstructions(session: Session<TState>): string | undefined {
    const mode = session.mode.resolve();
    const combined = [this.#instructions ?? '', mode?.instructions ?? ''].filter(Boolean).join('\n');
    return combined || undefined;
  }

  /**
   * Convert AgentInstructions (string | string[] | system message objects) to
   * a plain string for combining with mode instructions.
   */
  private instructionsToString(instructions: AgentInstructions): string {
    if (typeof instructions === 'string') return instructions;
    if (Array.isArray(instructions)) {
      return instructions
        .map(msg => (typeof msg === 'string' ? msg : typeof msg.content === 'string' ? msg.content : ''))
        .filter(Boolean)
        .join('\n\n');
    }
    return typeof instructions.content === 'string' ? instructions.content : '';
  }

  /**
   * Get the agent for the current mode.
   */
  /**
   * Resolve the Agent backing the current mode, with runtime services (storage,
   * pubsub, telemetry) propagated. Public so consumers like MastraCode's
   * GoalManager can drive the agent's native objective methods
   * (`setObjective`/`getObjective`/`clearObjective`/`updateObjectiveOptions`),
   * which read/write the durable `threadState` `'goal'` slot.
   */
  getCurrentAgent(session: Session<TState>): Agent {
    const mode = session.mode.resolve();

    return this.propagateRuntimeServicesToAgent(this.getAgentForMode(mode), session);
  }

  listActiveThreadRuns(): ActiveThreadRun[] {
    const byRunId = new Map<string, ActiveThreadRun>();
    for (const agent of this.backingAgents()) {
      for (const run of this.propagateRuntimeServicesToAgent(agent).listActiveThreadRuns()) {
        byRunId.set(run.runId, run);
      }
    }
    return [...byRunId.values()];
  }

  /**
   * Check if the current model's provider has authentication configured.
   * Delegates to the {@link GatewayManager} auth chain (the same resolution
   * the model router uses at run time). Returns `hasAuth: true` only when no
   * model is selected; gateway-chain failures return `hasAuth: false` so the
   * auth-status endpoint stays stable instead of erroring.
   */
  async getCurrentModelAuthStatus(session: Session<TState>): Promise<ModelAuthStatus> {
    const modelId = session.model.get();
    if (!modelId) return { hasAuth: true };

    // hasAuth returns false for expected missing-auth/missing-gateway cases.
    // It rethrows unexpected gateway failures (token exchange errors, network
    // bugs) — catch those here so the UI auth-status endpoint stays stable
    // and falls back to "no auth" instead of erroring.
    let hasAuth = true;
    try {
      hasAuth = this.#gatewayManager ? await this.#gatewayManager.hasAuth(modelId) : true;
    } catch {
      hasAuth = false;
    }
    if (hasAuth) return { hasAuth: true };

    // Surface the env-var hint from the catalog when available.
    try {
      const availableModels = await this.listAvailableModels();
      const currentModel = availableModels.find(model => model.id === modelId);
      if (currentModel) {
        return { hasAuth: false, apiKeyEnvVar: currentModel.apiKeyEnvVar };
      }
    } catch {
      // Ignore catalog lookup errors.
    }

    return { hasAuth: false };
  }

  /**
   * Get available models from the app-provided catalog hook with use counts applied.
   */
  async listAvailableModels(): Promise<AvailableModel[]> {
    const now = Date.now();
    if (this.availableModelsCache && now - this.availableModelsCacheTime < 10_000) {
      return this.availableModelsCache;
    }

    const useCounts = this.config.modelUseCountProvider?.() ?? {};
    const modelsById = new Map<string, AvailableModel>();

    const upsertModel = (model: Omit<AvailableModel, 'useCount'>): void => {
      if (!model.id || !model.provider || !model.modelName) return;
      modelsById.set(model.id, {
        ...model,
        useCount: useCounts[model.id] ?? 0,
      });
    };

    const catalog = await this.#gatewayManager!.listAvailableModels();
    for (const model of catalog) {
      upsertModel(model);
    }

    const result = [...modelsById.values()];
    this.availableModelsCache = result;
    this.availableModelsCacheTime = Date.now();
    return result;
  }

  invalidateAvailableModelsCache(): void {
    this.availableModelsCache = null;
    this.availableModelsCacheTime = 0;
  }

  // ===========================================================================
  // Thread Management
  // ===========================================================================

  /**
   * Point the session at a different memory resourceId. The resourceId itself
   * lives on the session (`session.identity`); the AgentController orchestrates the
   * surrounding teardown — dropping the current thread subscription and clearing
   * the active thread — since those are AgentController-owned.
   *
   * If a deletion is in progress for the session's current resource (or starts
   * during the re-key), the session is being torn down and re-keying is skipped
   * — the deletion's {@link #dropSessionFromRegistry} cleans up all keys.
   */
  async setResourceId(session: Session<TState>, { resourceId }: { resourceId: string }): Promise<void> {
    // If the session was already deleted (or deletion is in progress), don't
    // re-key it — a dead session must never be registered under a new key.
    if (this.#sessionsBeingDeleted.has(session)) return;

    const previousResourceId = session.identity.getResourceId();
    const scope = this.#sessionScopes.get(session);
    const oldKey = sessionRegistryKey(previousResourceId, scope);
    const newKey = sessionRegistryKey(resourceId, scope);

    // Wait for any in-progress deletion on the old key before touching the
    // session. If the session was deleted while we waited, skip re-keying
    // entirely — the session is dead and the deletion already cleaned up.
    const oldDeletion = this.#deletionsInProgress.get(oldKey);
    if (oldDeletion) {
      await oldDeletion;
      if (this.#sessionsBeingDeleted.has(session)) return;
    }

    session.thread.cleanupSubscription();
    session.identity.setResourceId({ resourceId });
    const releasePreviousThreadLock = session.thread.clearAndReleaseLock();

    // Re-key the resource registry so this session is the one resolved for its
    // new resourceId (and is no longer resolved for the old one). This session
    // becomes the authoritative owner of the target resource, replacing any
    // prior session registered there. The session keeps its creation scope, so
    // a scoped session re-keys under the same scope on the new resource.
    const dropPreviousResource = this.#dropSessionFromRegistry(oldKey, session);
    // Re-check that a deletion didn't start during the awaits above. If it
    // did, the session is being torn down — don't register it under the new
    // key; the deletion's #dropSessionFromRegistry cleans up all keys.
    if (this.#sessionsBeingDeleted.has(session)) {
      await releasePreviousThreadLock;
      await dropPreviousResource;
      const postDeletion = this.#deletionsInProgress.get(newKey) ?? this.#deletionsInProgress.get(oldKey);
      if (postDeletion) await postDeletion;
      return;
    }
    this.#sessionsByResource.set(newKey, Promise.resolve(session));
    await releasePreviousThreadLock;
    await dropPreviousResource;

    // A deletion may have started during the awaits. If so, the deletion's
    // #dropSessionFromRegistry already drops the new key (via the session's
    // current resourceId), but wait for it to finish so the caller sees a
    // consistent state.
    const postDeletion = this.#deletionsInProgress.get(newKey);
    if (postDeletion) await postDeletion;
  }

  /**
   * Remove `registryKey` from the registry only if it still resolves to
   * `session`. When the session is being torn down (tracked in
   * {@link #sessionsBeingDeleted}), also checks the session's current
   * resourceId (which may differ if {@link setResourceId} re-keyed the session
   * during deletion) and drops that key too, so an aborted session can't be
   * re-resolved by a subsequent {@link createSession} call.
   */
  async #dropSessionFromRegistry(registryKey: string, session: Session<TState>): Promise<void> {
    const pending = this.#sessionsByResource.get(registryKey);
    if (pending) {
      const resolved = await pending.catch(() => undefined);
      if (resolved === session && this.#sessionsByResource.get(registryKey) === pending) {
        this.#sessionsByResource.delete(registryKey);
      }
    }
    // When tearing down a session, also drop from the session's current
    // resourceId key, which may differ if setResourceId re-keyed the session
    // during deletion. Skip this for non-deletion calls (setResourceId itself
    // drops the old key and registers the new one — we must not undo that).
    if (!this.#sessionsBeingDeleted.has(session)) return;
    const scope = this.#sessionScopes.get(session);
    const currentKey = sessionRegistryKey(session.identity.getResourceId(), scope);
    if (currentKey !== registryKey) {
      const currentPending = this.#sessionsByResource.get(currentKey);
      if (currentPending) {
        const currentResolved = await currentPending.catch(() => undefined);
        if (currentResolved === session && this.#sessionsByResource.get(currentKey) === currentPending) {
          this.#sessionsByResource.delete(currentKey);
        }
      }
    }
  }

  async getKnownResourceIds(session: Session<TState>): Promise<string[]> {
    const threads = await session.thread.list({ allResources: true });
    const ids = new Set(threads.map(t => t.resourceId));
    return [...ids].sort();
  }

  // ===========================================================================
  // Observational Memory
  // ===========================================================================

  /**
   * Load observational memory progress for the current thread.
   * Reconstructs status from the durable OM record, then emits an `om_status` event for the UI.
   */
  async loadOMProgress(session: Session<TState>): Promise<void> {
    const threadId = session.thread.getId();
    if (!threadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const record = await memoryStorage.getObservationalMemory(threadId, session.identity.getResourceId());

      if (!record) return;

      const config = record.config as
        | {
            observation?: { messageTokens?: number | { min: number; max: number } };
            reflection?: { observationTokens?: number | { min: number; max: number } };
            _overrides?: {
              observation?: { messageTokens?: number | { min: number; max: number } };
              reflection?: { observationTokens?: number | { min: number; max: number } };
            };
          }
        | undefined;

      const getThreshold = (val: number | { min: number; max: number } | undefined, fallback: number): number => {
        if (!val) return fallback;
        if (typeof val === 'number') return val;
        return val.max;
      };

      const observationThreshold = getThreshold(
        config?._overrides?.observation?.messageTokens ?? config?.observation?.messageTokens,
        30_000,
      );
      const reflectionThreshold = getThreshold(
        config?._overrides?.reflection?.observationTokens ?? config?.reflection?.observationTokens,
        40_000,
      );
      const messageTokens = record.pendingMessageTokens ?? 0;
      const observationTokens = record.observationTokenCount ?? 0;
      // Some storage backends return the chunk list serialized, so parse defensively
      // (mirrors the OM processor's own `getBufferedChunks` helper).
      const rawChunks = record.bufferedObservationChunks;
      let bufferedChunks: { messageTokens?: number; tokenCount?: number }[] = [];
      if (Array.isArray(rawChunks)) {
        bufferedChunks = rawChunks;
      } else if (typeof rawChunks === 'string') {
        try {
          const parsed = JSON.parse(rawChunks);
          if (Array.isArray(parsed)) bufferedChunks = parsed;
        } catch {
          bufferedChunks = [];
        }
      }
      const bufferedMessageTokens = Math.min(
        bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0),
        messageTokens,
      );
      const bufferedObservationTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);
      const bufferedObs = {
        status: record.isBufferingObservation
          ? ('running' as const)
          : bufferedChunks.length
            ? ('complete' as const)
            : ('idle' as const),
        chunks: bufferedChunks.length,
        messageTokens: bufferedMessageTokens,
        // The real projection depends on the OM processor's activation boundary math,
        // which isn't reproducible from the record alone. Report 0 until the first live
        // status arrives rather than an authoritative-looking approximation.
        projectedMessageRemoval: 0,
        observationTokens: bufferedObservationTokens,
      };
      const bufferedRef = {
        status: record.isBufferingReflection
          ? ('running' as const)
          : record.bufferedReflection
            ? ('complete' as const)
            : ('idle' as const),
        inputObservationTokens: record.bufferedReflectionInputTokens ?? 0,
        observationTokens: record.bufferedReflectionTokens ?? 0,
      };
      const generationCount = record.generationCount ?? 0;
      // Step index is per-run and intentionally not durable — a restored thread starts at 0
      // and picks up the real step number from the next live status update.
      const stepNumber = 0;

      session.emit({
        type: 'om_status',
        windows: {
          active: {
            messages: { tokens: messageTokens, threshold: observationThreshold },
            observations: { tokens: observationTokens, threshold: reflectionThreshold },
          },
          buffered: { observations: bufferedObs, reflection: bufferedRef },
        },
        recordId: record.id ?? '',
        threadId,
        stepNumber,
        generationCount,
      });
    } catch {
      // OM not available or not initialized — that's fine
    }
  }

  async getObservationalMemoryRecord(session: Session<TState>): Promise<ObservationalMemoryRecord | null> {
    if (!session.thread.getId()) return null;

    try {
      const memoryStorage = await this.getMemoryStorage();
      return await memoryStorage.getObservationalMemory(session.thread.getId(), session.identity.getResourceId());
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Permissions
  // ===========================================================================

  getToolCategory({ toolName }: { toolName: string }): ToolCategory | null {
    return this.config.toolCategoryResolver?.(toolName) ?? null;
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Resolve the `activeTools` allowlist for the current mode's run.
   *
   * Returns `undefined` when the mode has no `availableTools` configured
   * (no restriction — all tools visible). When the mode declares
   * `availableTools`, returns that list filtered to remove tools whose
   * permission category is denied.
   *
   * Per-tool `deny` is already handled by `buildToolsets` (denied tools are
   * deleted from the toolsets), so those tools won't exist at execution time
   * regardless of whether they appear in the allowlist.
   *
   * The returned list uses the same exposed tool names the execution pipeline
   * checks against (e.g. `view`, `write_file`, `ask_user`), which matches the
   * names workspace tools are renamed to via `TOOL_NAME_OVERRIDES`.
   */
  private resolveModeActiveTools(session: Session<TState>): string[] | undefined {
    const currentMode = session.mode.resolve();
    const availableTools = currentMode?.availableTools;
    if (!availableTools) {
      return undefined;
    }
    if (availableTools.length === 0) {
      return [];
    }

    const permissionRules = session.permissions.getRules();
    const deniedTools = new Set(
      Object.entries(permissionRules.tools)
        .filter(([, policy]) => policy === 'deny')
        .map(([tool]) => tool),
    );
    const deniedCategories = new Set(
      Object.entries(permissionRules.categories)
        .filter(([, policy]) => policy === 'deny')
        .map(([cat]) => cat),
    );

    if (deniedTools.size === 0 && deniedCategories.size === 0) {
      return availableTools;
    }

    return availableTools.filter(toolName => {
      // Per-tool deny always wins — even over the mode allowlist.
      if (deniedTools.has(toolName)) {
        return false;
      }
      // Category deny: tools with no category (null — always-allowed tools
      // like ask_user) are not subject to category deny.
      const category = this.getToolCategory({ toolName });
      return !category || !deniedCategories.has(category);
    });
  }

  private async buildAgentMessageStreamOptions({
    session,
    requestContext: requestContextInput,
    tracingContext,
    tracingOptions,
  }: {
    session: Session<TState>;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<Record<string, unknown>> {
    const runThreadId = session.thread.getId();
    if (!runThreadId) {
      throw new Error('Cannot build stream options without a current thread');
    }

    session.run.clearAbortRequested();
    // Reconcile the in-memory model selection with the persisted per-mode model
    // before snapshotting it into the request context. In multiplayer
    // deployments another process (or a freshly-created Session for an existing
    // thread) may have persisted a different model; the per-instance cache would
    // otherwise run with a stale selection. No-op in the single-player TUI.
    await session.model.syncFromPersisted({ modeId: session.mode.get() });
    const requestContext = await this.buildRequestContext(session, requestContextInput);
    // Resolve mode-aware instructions at call time so the agent's own
    // instructions are never mutated by the harness.
    // When mode/harness instructions exist, combine them with the agent's
    // own instructions so dynamic instructions (e.g. AGENTS.md, project
    // context) aren't lost — the agent treats options.instructions as a
    // full override.
    let callTimeInstructions: string | undefined;
    if (this.config.agent) {
      const modeInstructions = this.resolveCurrentModeInstructions(session);
      if (modeInstructions) {
        const agent = this.getCurrentAgent(session);
        const agentInstructions = await agent.getInstructions({ requestContext });
        const agentStr = this.instructionsToString(agentInstructions);
        callTimeInstructions = [agentStr, modeInstructions].filter(Boolean).join('\n') || undefined;
      }
      // When no mode instructions, don't pass instructions — the agent
      // uses its own getInstructions() naturally.
    }

    const streamOptions: Record<string, unknown> = {
      ...this.buildSharedRunOptions(session),
      memory: {
        thread: runThreadId,
        resource: session.identity.getResourceId(),
        // Titling outlives the run, so the thread it named is the one captured here,
        // not whichever thread the session happens to hold when the model answers.
        onTitleGenerated: (title: string) =>
          session.emit({ type: 'thread_title_updated', threadId: runThreadId, title }),
      },
      abortSignal: session.run.ensureAbortController().signal,
      requestContext,
      outputWriter: async (chunk: { type?: string; data?: unknown }) => {
        if (chunk.type !== 'data-mastracode-tool-progress') return;
        const data = chunk.data as { toolCallId?: string; progress?: unknown } | undefined;
        if (!data?.toolCallId || data.progress === undefined) return;

        session.emit({ type: 'tool_update', toolCallId: data.toolCallId, partialResult: data.progress });
        const output = this.formatToolProgressOutput(data.progress);
        if (output) {
          session.emit({ type: 'shell_output', toolCallId: data.toolCallId, output, stream: 'stdout' });
        }
      },
      ...(tracingContext && { tracingContext }),
      ...(tracingOptions && { tracingOptions }),
      ...(callTimeInstructions && { instructions: callTimeInstructions }),
    };
    streamOptions.toolsets = await this.buildToolsets(session, requestContext);

    // Apply mode-level tool visibility via `activeTools` — the same mechanism
    // the execution pipeline already enforces at tool-call time.  Only set
    // when the helper returns a concrete list so modes without
    // `availableTools` keep unrestricted behaviour.
    const activeTools = this.resolveModeActiveTools(session);
    if (activeTools !== undefined) {
      streamOptions.activeTools = activeTools;
    }

    return streamOptions;
  }

  private formatToolProgressOutput(progress: unknown): string {
    if (typeof progress === 'string') return progress.endsWith('\n') ? progress : `${progress}\n`;
    if (typeof progress !== 'object' || progress === null) return `${String(progress)}\n`;

    const record = progress as { status?: unknown; detail?: unknown };
    const parts = [record.status, record.detail].filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    );
    return parts.length > 0 ? `${parts.join(': ')}\n` : '';
  }

  /**
   * Options that every harness-driven agent run must carry — the initial stream
   * AND every `resumeStream`. Centralized so the two paths can't drift: a
   * missing `maxSteps` on resume silently caps the resumed run at the agent's
   * small default and ends it mid-task (see {@link HARNESS_MAX_STEPS}).
   */
  private buildSharedRunOptions(session: Session<TState>): Record<string, unknown> {
    const isYolo = (session.state.get() as Record<string, unknown>).yolo === true;
    // Channel sessions on adapters that can't render approval buttons must
    // auto-approve tools — a required approval would park the run forever on
    // a card nobody can answer. Tracked on the channels instance rather than
    // session state so the controller's `stateSchema` never sees it.
    const channelAutoApprove = this.#channels?.__isAutoApproveResource(session.identity.getResourceId()) === true;
    const shared: Record<string, unknown> = {
      maxSteps: CONTROLLER_MAX_STEPS,
      savePerStep: false,
      requireToolApproval: !isYolo && !channelAutoApprove,
    };

    // Auto-enable Anthropic server-side fallbacks for fable-5 so a classifier
    // block is transparently retried on the fallback model instead of failing.
    const fableFallback = buildFableFallbackProviderOptions(session.model.get());
    if (fableFallback) {
      shared.providerOptions = { anthropic: { ...fableFallback.anthropic } };
    }

    return shared;
  }

  /**
   * Persist a system-reminder message for a thread (host-owned storage). Throws
   * when no storage is configured — the Session guards the no-thread case before
   * calling. Returns the saved {@link MastraDBMessage}.
   */
  private async saveSystemReminder({
    threadId,
    resourceId,
    message,
    reminderType,
    role,
    metadata,
  }: {
    threadId: string;
    resourceId: string;
    message: string;
    reminderType: string;
    role: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
  }): Promise<MastraDBMessage | null> {
    if (!this.#resolveStorage()) return null;
    const memoryStorage = await this.getMemoryStorage();
    const dbMessage = {
      id: randomUUID(),
      role,
      threadId,
      resourceId,
      createdAt: new Date(),
      content: {
        format: 2 as const,
        parts: [],
        content: '',
        metadata: {
          systemReminder: {
            type: reminderType,
            message,
            ...metadata,
          },
        },
      },
    };

    const result = await memoryStorage.saveMessages({ messages: [dbMessage] });
    const saved = result.messages[0] ?? dbMessage;
    return this.convertToControllerMessage(saved);
  }

  /**
   * Resolve the mode the session transitions to when a plan is approved: the
   * current mode's `transitionsTo`, else the configured default mode. The mode
   * catalog is AgentController config, so this is host-owned. Returns `undefined` when
   * no default mode is configured.
   */
  private resolveTransitionModeId(session: Session<TState>): string | undefined {
    const currentMode = session.mode.resolve();
    const transitionModeId =
      currentMode.transitionsTo ??
      this.config.defaultModeId ??
      this.config.modes.find(mode => mode.default || mode.metadata?.default === true)?.id ??
      this.config.modes[0]?.id;
    return this.listModes().find(mode => mode.id === transitionModeId)?.id;
  }

  private convertToControllerMessage(msg: {
    id: string;
    role: MastraDBMessage['role'];
    createdAt: Date;
    threadId?: string;
    resourceId?: string;
    type?: string;
    content: MastraMessageContentV2;
  }): MastraDBMessage {
    // DB-native passthrough: the agent-controller now exposes the canonical persisted
    // MastraDBMessage shape directly. No flattening into a UI content union — consumers
    // read content.parts (and role === "signal" + content.metadata.signal) themselves.
    return {
      id: msg.id,
      role: msg.role,
      createdAt: msg.createdAt,
      ...(msg.threadId !== undefined ? { threadId: msg.threadId } : {}),
      ...(msg.resourceId !== undefined ? { resourceId: msg.resourceId } : {}),
      ...(msg.type !== undefined ? { type: msg.type } : {}),
      content: msg.content,
    };
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  private getSubagentDisplayName(agentType: string): string | undefined {
    return this.config.subagents?.find(subagent => subagent.id === agentType)?.name;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================
  //
  // The Session owns the event bus. To observe events, subscribe on a session:
  // `harness.session.subscribe(listener)`. Internal orchestration emits on the
  // session it is driving via `session.emit(...)`.

  // ===========================================================================
  // Runtime Context
  // ===========================================================================

  /**
   * Build the toolsets object that includes built-in harness tools (ask_user, submit_plan,
   * and optionally subagent) plus any user-configured tools.
   * Used by sendMessage, handleToolApprove, and handleToolDecline.
   */
  private async buildToolsets(session: Session<TState>, requestContext: RequestContext): Promise<ToolsetsInput> {
    const builtInTools: ToolsInput = {
      ask_user: askUserTool,
      submit_plan: submitPlanTool,
      task_write: taskWriteTool,
      task_update: taskUpdateTool,
      task_complete: taskCompleteTool,
      task_check: taskCheckTool,
    };

    // Resolve user-configured controller tools (needed for both the controller toolset and subagent allowedControllerTools)
    let resolvedControllerTools: ToolsInput | undefined = undefined;
    if (this.config.tools) {
      const tools =
        typeof this.config.tools === 'function' ? await this.config.tools({ requestContext }) : this.config.tools;
      if (tools) {
        resolvedControllerTools = { ...tools };
      }
    }

    // Auto-create subagent tool if subagent definitions are configured.
    // Model resolution flows through the gateways registered on the internal
    // Mastra instance: `resolveModel` returns the bare model id string and the
    // created subagent Agent receives the internal Mastra via its constructor
    // so the model router resolves through the same gateways as the parent.
    if (this.config.subagents?.length) {
      const currentMode = session.mode.resolve();
      const hasMemory = Boolean(this.config.memory);
      builtInTools.subagent = createSubagentTool({
        subagents: this.config.subagents,
        resolveModel: (modelId: string) => modelId,
        mastra: this.getMastra(),
        controllerTools: resolvedControllerTools,
        fallbackModelId: currentMode?.defaultModelId,
        getParentModelId: () => session.model.get(),
        // Resolved lazily so forked subagents see the current mode's agent
        // even if the mode switches between tool-call scheduling and execution.
        getParentAgent: () => {
          try {
            return this.getCurrentAgent(session);
          } catch {
            return undefined;
          }
        },
        // Only wired up when memory is configured. Clones at the memory layer
        // (not via AgentController.cloneThread) so the parent thread stays the active
        // thread while the forked subagent runs on the clone.
        //
        // The clone is tagged with `forkedSubagent: true` + `parentThreadId` so
        // that thread pickers / startup flows can hide transient fork threads —
        // see `listThreads` (filtered by default).
        cloneThreadForFork: hasMemory
          ? async ({ sourceThreadId, resourceId, title }) => {
              const memory = await this.resolveMemory(session);
              const result = await memory.cloneThread({
                sourceThreadId,
                resourceId: resourceId ?? session.identity.getResourceId(),
                title,
                metadata: {
                  forkedSubagent: true,
                  parentThreadId: sourceThreadId,
                },
              });
              return { id: result.thread.id, resourceId: result.thread.resourceId };
            }
          : undefined,
        // Forks inherit the parent's toolsets verbatim so harness-injected
        // tools (`ask_user`, `submit_plan`, user-configured harness tools, etc.)
        // remain available inside the fork. The `subagent` entry itself is
        // deliberately kept — its schema/description are part of the parent's
        // prompt-cache prefix, and stripping it would invalidate the cache.
        // Recursive forking is blocked at runtime instead: see the patched
        // `subagent` execute that the forked tool path installs in `tools.ts`.
        getParentToolsets: forkRequestContext => this.buildToolsets(session, forkRequestContext ?? requestContext),
      });
    }

    // Remove any explicitly disabled built-in tools
    if (this.config.disableBuiltinTools?.length) {
      for (const toolId of this.config.disableBuiltinTools) {
        delete builtInTools[toolId];
      }
    }

    const permissionRules = session.permissions.getRules();
    for (const [toolId, policy] of Object.entries(permissionRules.tools)) {
      if (policy === 'deny') {
        delete builtInTools[toolId];
        delete resolvedControllerTools?.[toolId];
      }
    }

    const result: ToolsetsInput = { controllerBuiltIn: builtInTools };
    if (resolvedControllerTools) {
      result.controller = resolvedControllerTools;
    }

    // When using a shared backing agent, mode-specific tool overrides are
    // delivered through toolsets (not baked into the agent) so the agent's
    // own tools (including signal-provider tools) are never lost.
    //
    // Note: both `mode.tools` and `mode.additionalTools` are added as a
    // toolset (augment).  True "replace" semantics (masking the agent's own
    // tools) would require per-run tool filtering in the Agent, which isn't
    // supported yet.  validateModes() already prevents setting both on the
    // same mode.
    if (this.config.agent) {
      const currentMode = session.mode.resolve();
      const modeTools = currentMode.tools ?? currentMode.additionalTools;
      if (modeTools) {
        result.modeTools = modeTools;
      }
    }

    return result;
  }

  /**
   * Build request context for agent execution.
   * Tools can access controller state via requestContext.get('controller').
   */
  private async buildRequestContext(
    session: Session<TState>,
    requestContext?: RequestContext,
  ): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const controllerContext: AgentControllerRequestContext<TState> = {
      controllerId: this.id,
      harnessId: this.id,
      state: session.state.get(),
      getState: () => session.state.get(),
      setState: updates => session.state.set(updates),
      updateState: updater => session.state.update(updater),
      threadId: session.thread.getId(),
      resourceId: session.identity.getResourceId(),
      scope: this.#sessionScopes.get(session),
      session: {
        id: session.identity.getId(),
        ownerId: session.identity.getOwnerId(),
        modeId: session.mode.get(),
        modelId: session.model.get(),
        state: {
          get: () => session.state.get(),
          set: updates => session.state.set(updates),
          update: updater => session.state.update(updater),
        },
      },
      abortSignal: session.run.getAbortSignal(),
      emitEvent: event => session.emit(event),
      getSubagentModelId: params => session.subagents.model.get(params ?? {}),
    };

    requestContext.set('controller', controllerContext);

    return requestContext;
  }

  /**
   * Resolve memory from config — handles both static instances and dynamic factory functions.
   */
  private async resolveMemory(session: Session<TState>): Promise<MastraMemory> {
    const mem = this.config.memory;
    if (!mem) {
      throw new Error('Memory is not configured on this AgentController');
    }
    if (typeof mem !== 'function') {
      return mem;
    }
    const requestContext = await this.buildRequestContext(session);
    const resolved = await Promise.resolve(mem({ requestContext }));
    if (!resolved) {
      throw new Error('Dynamic memory factory returned empty value');
    }
    return resolved;
  }

  // ===========================================================================
  // Token Usage
  // ===========================================================================

  private async persistTokenUsage(session: Session<TState>): Promise<void> {
    const threadId = session.thread.getId();
    if (!threadId || !this.#resolveStorage()) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (thread) {
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: { ...thread.metadata, tokenUsage: session.getTokenUsage() },
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Token persistence is not critical
    }
  }

  // ===========================================================================
  // Interval Handlers
  // ===========================================================================

  private startIntervals(): void {
    const handlers = [...(this.config.intervalHandlers ?? [])];
    if (!handlers.length) return;

    for (const iv of handlers) {
      if (this.intervalTimers.has(iv.id)) continue;

      const run = async () => {
        try {
          await iv.handler();
        } catch (error) {
          console.error(`[Interval:${iv.id}] failed:`, error);
        }
      };

      if (iv.immediate !== false) {
        void run();
      }

      const timer = setInterval(run, iv.intervalMs);
      timer.unref();
      this.intervalTimers.set(iv.id, { timer, shutdown: iv.shutdown });
    }
  }

  registerInterval(handler: IntervalHandler): void {
    void this.removeInterval({ id: handler.id });

    const run = async () => {
      try {
        await handler.handler();
      } catch (error) {
        console.error(`[Interval:${handler.id}] failed:`, error);
      }
    };

    if (handler.immediate !== false) {
      void run();
    }

    const timer = setInterval(run, handler.intervalMs);
    timer.unref();
    this.intervalTimers.set(handler.id, { timer, shutdown: handler.shutdown });
  }

  async removeInterval({ id }: { id: string }): Promise<void> {
    const entry = this.intervalTimers.get(id);
    if (entry) {
      clearInterval(entry.timer);
      this.intervalTimers.delete(id);
      try {
        await entry.shutdown?.();
      } catch (error) {
        console.error(`[Interval:${id}] shutdown failed:`, error);
      }
    }
  }

  async stopIntervals(): Promise<void> {
    const entries = [...this.intervalTimers.entries()];
    this.intervalTimers.clear();

    for (const [id, entry] of entries) {
      clearInterval(entry.timer);
      try {
        await entry.shutdown?.();
      } catch (error) {
        console.error(`[Interval:${id}] shutdown failed:`, error);
      }
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async destroy(): Promise<void> {
    // The AgentController owns no session; per-session teardown (thread-subscription
    // cleanup) is the caller's responsibility via `session.thread.*`. Here we
    // only tear down AgentController-shared resources.
    await this.stopIntervals();
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private generateId(): string {
    if (this.config.idGenerator) {
      return this.config.idGenerator();
    }
    return randomUUID();
  }
}
