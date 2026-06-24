import { randomUUID } from 'node:crypto';

import { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { mastraDBMessageToSignal } from '../agent/signals';
import type { AgentInstructions, ToolsInput, ToolsetsInput } from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
import { HarnessChannels } from '../channels/harness-channels';
import { getErrorFromUnknown } from '../error';
import { GatewayManager } from '../llm/model/gateways';
import { defaultGateways } from '../llm/model/gateways/defaults';
import { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { StorageThreadType } from '../memory/types';
import type { TracingContext, TracingOptions } from '../observability';
import { RequestContext } from '../request-context';
import type { MastraCompositeStore } from '../storage/base';
import type { MemoryStorage } from '../storage/domains/memory/base';
import type { ObservationalMemoryRecord } from '../storage/types';
import { Workspace } from '../workspace/workspace';
import type { WorkspaceConfig } from '../workspace/workspace';

import { Session } from './session';
import type { ThreadDataStore } from './session';
import {
  getRecordValue,
  signalContentsToHarnessContent,
  signalContentsToText,
  toNotificationContent,
  toNotificationSummaryContent,
  toReactiveSignalContent,
  toStateSignalContent,
  toSystemReminderContent,
  toUserSignalMessage,
} from './stream-content';
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
  HeartbeatHandler,
  HarnessConfig,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode,
  HarnessRequestContext,
  HarnessThread,
  ModelAuthStatus,
  ToolCategory,
} from './types';

function validateModes(modes: HarnessMode[]): void {
  const modeIds = new Set<string>();

  for (const mode of modes) {
    if (modeIds.has(mode.id)) {
      throw new Error(`Duplicate mode id "${mode.id}" found when creating the Harness`);
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
 * silently stop. Returning a message here lets the harness finalize the run
 * into an explicit terminal error state.
 */
/**
 * The Anthropic model that `claude-fable-5` runs are automatically retried on
 * server-side when fable-5's safety classifiers block a turn. See
 * {@link buildFableFallbackProviderOptions}.
 */
const FABLE_FALLBACK_MODEL = 'claude-opus-4-8';

/**
 * Step budget applied to every harness-driven agent run.
 *
 * This MUST be passed to both the initial stream and `resumeStream`: when a run
 * suspends on an interactive tool (e.g. `ask_user`) and then resumes, the
 * resumed call merges over the agent's *default* options, whose `maxSteps` is
 * small (~5). Without re-supplying this budget the resumed run is silently
 * capped and ends with `reason:"complete"` after a few steps — the agent stops
 * mid-task even though it promised to continue. See {@link buildSharedRunOptions}.
 */
const HARNESS_MAX_STEPS = 1000;

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
/**
 * The Harness orchestrates multiple agent modes, shared state, memory, and storage.
 * It's the core abstraction that a TUI (or other UI) controls.
 *
 * @example
 * ```ts
 * const harness = new Harness({
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
 * harness.subscribe((event) => {
 *   if (event.type === "message_update") renderMessage(event.message)
 * })
 *
 * await harness.init()
 * await harness.sendMessage({ content: "Hello!" })
 * ```
 */
export class Harness<TState = {}> {
  readonly id: string;

  private config: HarnessConfig<TState>;
  private workspace: Workspace | undefined = undefined;
  private workspaceFn:
    | ((ctx: {
        requestContext: RequestContext;
        mastra?: Mastra;
      }) => Promise<Workspace | undefined> | Workspace | undefined)
    | undefined = undefined;
  private workspaceInitialized = false;
  private initPromise: Promise<void> | undefined = undefined;
  private workspaceError: Error | undefined = undefined;
  private browser: MastraBrowser | undefined = undefined;
  private browserFn:
    | ((ctx: { requestContext: RequestContext }) => Promise<MastraBrowser | undefined> | MastraBrowser | undefined)
    | undefined = undefined;
  private heartbeatTimers = new Map<string, { timer: NodeJS.Timeout; shutdown?: () => void | Promise<void> }>();
  /**
   * The mode every new session starts in. Resolved once at construction from
   * `config.defaultModeId` (or the configured default/first mode) and reused by
   * every {@link createSession} call. The Harness itself holds no session.
   */
  readonly #defaultMode: HarnessMode;
  /**
   * Live sessions created by {@link createSession}, keyed by resourceId. A
   * resourceId maps to exactly one session per Harness (get-or-create). Stores
   * the in-flight creation promise so concurrent calls share one session. Lets
   * Harness-external callers (e.g. notification delivery) resolve "the session
   * that owns this resource" so a woken run uses that session's model/mode/state
   * instead of an arbitrary one.
   */
  readonly #sessionsByResource = new Map<string, Promise<Session<TState>>>();
  private availableModelsCache: AvailableModel[] | null = null;
  private availableModelsCacheTime: number = 0;
  readonly #instructions?: string;
  #internalMastra: Mastra | undefined = undefined;
  /**
   * Set when this Harness is registered on a parent Mastra (via
   * {@link __registerMastra}). When present it is used in place of the
   * lazily-created internal Mastra, so a server-hosted Harness shares the
   * server's storage/agents/gateways instead of spinning up its own.
   */
  #externalMastra: Mastra | undefined = undefined;
  #gatewayManager: GatewayManager | undefined = undefined;
  #legacyAgentMode: Record<string, Agent<any, any, any, any>> = {};
  #channels: HarnessChannels | undefined = undefined;

  constructor(config: HarnessConfig<TState>) {
    validateModes(config.modes);

    this.id = config.id;
    this.config = config;
    this.#instructions = config.instructions;
    // Gateway manager merges configured gateways with the router defaults
    // (custom takes precedence). Shared by listAvailableModels,
    // getCurrentModelAuthStatus, and the OM model resolver.
    this.#gatewayManager = new GatewayManager([...(config.gateways ?? []), ...defaultGateways]);

    if (config.channels) {
      this.#channels =
        config.channels instanceof HarnessChannels ? config.channels : new HarnessChannels({ ...config.channels });
      this.#channels.__setHarness(this);
    }

    const defaultMode = config.defaultModeId
      ? config.modes.find(mode => mode.id === config.defaultModeId)
      : (config.modes.find(mode => mode.default || mode.metadata?.default === true) ?? config.modes[0]);
    if (!defaultMode) {
      throw new Error(
        config.defaultModeId
          ? `Default mode not found: ${config.defaultModeId}`
          : 'Harness requires at least one agent mode',
      );
    }

    this.#defaultMode = defaultMode;

    // Store workspace: pre-built instance, dynamic factory, or config (constructed in init())
    if (config.workspace instanceof Workspace) {
      this.workspace = config.workspace;
    } else if (typeof config.workspace === 'function') {
      this.workspaceFn = config.workspace;
    }

    // Store browser: pre-built instance or dynamic factory
    if (config.browser && typeof config.browser !== 'function') {
      this.browser = config.browser;
    } else if (typeof config.browser === 'function') {
      this.browserFn = config.browser;
    }
  }

  /**
   * Wire a freshly-constructed {@link Session} to this Harness: install the
   * thread-settings store, resolvers (mode/model/om/permissions/subagents),
   * thread data store, and seed the initial mode + model. Returns the same
   * session for convenient assignment.
   *
   * The session owns its own event bus, so the Harness no longer injects an
   * `emit` callback — `#wireSession` only injects genuinely Harness-owned
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
   * the default mode with the seeded model, is connected to the Harness's shared
   * machinery (agent, storage/lock, config catalog), and has a current thread
   * (the most recent thread for `resourceId`, or a freshly created one).
   *
   * The Harness owns no session of its own — every consumer creates its own
   * session and drives all work through it (`session.sendMessage`,
   * `session.mode.switch`, `session.thread.*`, `session.subscribe`, ...). In a
   * server / multiplayer setting, each request / thread / user gets its own
   * session, isolated from every other: independent event bus, mode, model,
   * state, and current thread.
   *
   * Call {@link init} once before creating sessions so shared storage and
   * workspace are ready.
   *
   * @param id - Stable session identifier (mirrors `SessionRecord.id`). Required.
   * @param ownerId - Stable session owner (mirrors `SessionRecord.ownerId`). Required.
   * @param resourceId - Memory resource to bind this session to. Defaults to the harness `resourceId` or `id`.
   */
  async createSession({
    resourceId,
    ownerId,
    id,
  }: {
    resourceId?: string;
    id: string;
    ownerId: string;
  }): Promise<Session<TState>> {
    const effectiveResourceId = resourceId ?? this.config.resourceId ?? this.config.id;

    // Get-or-create: a resourceId maps to exactly one durable session per
    // Harness. Asking for the same resource twice returns the same session, so
    // a user/thread always resumes their own session and notification delivery
    // reuses it rather than spawning a split-brain duplicate. Cache the in-flight
    // promise so concurrent calls for the same resource resolve to one session.
    const existing = this.#sessionsByResource.get(effectiveResourceId);
    if (existing) {
      return existing;
    }

    const creation = this.#createSessionForResource(ownerId, id, effectiveResourceId);
    this.#sessionsByResource.set(effectiveResourceId, creation);
    try {
      return await creation;
    } catch (error) {
      // Don't cache a failed creation — let the next call retry.
      if (this.#sessionsByResource.get(effectiveResourceId) === creation) {
        this.#sessionsByResource.delete(effectiveResourceId);
      }
      throw error;
    }
  }

  async #createSessionForResource(ownerId: string, id: string, effectiveResourceId: string): Promise<Session<TState>> {
    const session = this.#wireSession(
      new Session({
        resourceId: effectiveResourceId,
        id,
        ownerId,
        state: {
          initialState: this.config.initialState,
          stateSchema: this.config.stateSchema,
        },
      }),
    );

    // Replay current workspace status onto the new session so a session created
    // after init() still observes the shared workspace being ready (or failed).
    if (this.workspace && this.workspaceInitialized) {
      session.emit({ type: 'workspace_status_changed', status: 'ready' });
      session.emit({
        type: 'workspace_ready',
        workspaceId: this.workspace.id,
        workspaceName: this.workspace.name,
      });
    } else if (this.workspaceError) {
      session.emit({ type: 'workspace_status_changed', status: 'error', error: this.workspaceError });
      session.emit({ type: 'workspace_error', error: this.workspaceError });
    }

    // Bring the session online with a current thread: resume the most recent
    // thread for this resource, or create a fresh one when none exist.
    const threads = await session.thread.list();
    if (threads.length === 0) {
      await session.thread.create();
    } else {
      const mostRecent = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]!;
      await this.config.threadLock?.acquire(mostRecent.id);
      session.thread.set({ threadId: mostRecent.id });
      await session.thread.loadMetadata();
      await session.thread.ensureCurrentSubscription();
    }

    return session;
  }

  /**
   * Resolve a live session by resourceId, if one was created for it via
   * {@link createSession}. Returns `undefined` when no session owns the
   * resource. Used by notification delivery to run woken signals as the session
   * that owns the target thread, rather than an arbitrary session.
   */
  async getSessionByResource(resourceId: string): Promise<Session<TState> | undefined> {
    return this.#sessionsByResource.get(resourceId);
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Access the Mastra instance backing this Harness.
   *
   * Returns the parent Mastra when this Harness is registered on one (see
   * {@link __registerMastra}); otherwise the internal Mastra created during
   * `init()` when storage is configured.
   *
   * Useful for scorer registration, observability access, and eval tooling.
   */
  getMastra(): Mastra | undefined {
    return this.#externalMastra ?? this.#internalMastra;
  }

  /**
   * The {@link HarnessChannels} instance that connects this Harness to messaging
   * platforms, or `undefined` when no `channels` were configured.
   */
  getChannels(): HarnessChannels | undefined {
    return this.#channels;
  }

  /**
   * Register this Harness on a parent Mastra. Called by Mastra during
   * construction when a harness is passed in its config. Once registered, the
   * Harness uses the parent Mastra (its storage, agents, gateways, and
   * observability) instead of building its own internal one during `init()`.
   *
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.#externalMastra = mastra;
  }

  /**
   * Resolve the storage this Harness reads and writes through.
   *
   * When registered on a parent Mastra, the Harness inherits that Mastra's
   * configured storage so the host and its Harnesses persist to a single store.
   * A standalone Harness falls back to its own `config.storage`.
   */
  #resolveStorage(): MastraCompositeStore | undefined {
    return this.#externalMastra?.getStorage() ?? this.config.storage;
  }

  /**
   * Sets or updates the harness-level browser and propagates it to mode agents.
   */
  setBrowser(browser: MastraBrowser | undefined): void {
    this.browser = browser;
    this.browserFn = undefined;

    // Collect unique agents: shared backing agent + any deprecated mode.agent
    // instances so all receive the browser (signal providers may be attached to
    // any of them).
    const agents = new Set<Agent<any, any, any, any>>();
    if (this.config.agent) {
      agents.add(this.config.agent);
    }
    for (const mode of this.config.modes) {
      if (mode.agent || !this.config.agent) {
        agents.add(this.getAgentForMode(mode));
      }
    }
    for (const agent of agents) {
      agent.setBrowser(browser);
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the harness — loads storage and workspace.
   * Must be called before using the harness. Idempotent: repeated calls
   * return the same in-flight/completed initialization instead of rebuilding
   * the internal Mastra instance (which would orphan registered agents).
   */
  async init(): Promise<void> {
    this.initPromise ??= this.runInit();
    return this.initPromise;
  }

  private async runInit(): Promise<void> {
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

    // Initialize workspace if configured (skip for dynamic factory — resolved per-request)
    if (this.config.workspace && !this.workspaceInitialized && !this.workspaceFn) {
      try {
        if (!this.workspace) {
          this.workspace = new Workspace(this.config.workspace as WorkspaceConfig);
        }

        await this.workspace.init();
        this.workspaceInitialized = true;
        this.workspaceError = undefined;
      } catch (error) {
        const err = getErrorFromUnknown(error);
        this.workspace = undefined;
        this.workspaceInitialized = false;
        // Remember the failure so sessions created later can surface it; the
        // Harness holds no session of its own to emit onto during init().
        this.workspaceError = err;
      }
    }

    // Propagate harness-level Mastra, memory, workspace, browser, and pubsub
    // to the agent(s) that back each mode (after workspace init).
    // Collect unique agents: shared backing agent + any deprecated mode.agent
    // instances so all receive runtime services.
    const agents = new Set<Agent<any, any, any, any>>();
    if (this.config.agent) {
      agents.add(this.config.agent);
    }
    for (const mode of this.config.modes) {
      if (mode.agent || !this.config.agent) {
        agents.add(this.getAgentForMode(mode));
      }
    }
    for (const agent of agents) {
      this.propagateRuntimeServicesToAgent(agent);
    }

    this.startHeartbeats();
  }

  private async getMemoryStorage(): Promise<MemoryStorage> {
    const storage = this.#resolveStorage();
    if (!storage) {
      throw new Error('Storage is not configured on this Harness');
    }
    const memoryStorage = await storage.getStore('memory');
    if (!memoryStorage) {
      throw new Error('Storage does not have a memory domain configured');
    }
    return memoryStorage;
  }

  /**
   * The shared-host storage gateway the Session's thread domain reads/writes
   * through. The Session owns the thread-domain logic; this adapter just maps
   * raw storage rows to Harness types — it does not call back into Session.
   */
  private createThreadDataStore(session: Session<TState>): ThreadDataStore {
    return {
      listThreads: ({ resourceId, includeForkedSubagents }) =>
        this.queryThreads({ resourceId, includeForkedSubagents }),
      getById: ({ threadId }) => this.queryThreadById({ threadId }),
      listMessages: ({ threadId, limit }) => this.queryThreadMessages({ threadId, limit }),
      firstUserMessages: ({ threadIds }) => this.queryFirstUserMessages({ threadIds }),
      getMetadata: ({ threadId, key }) => this.readThreadMetadataValue({ threadId, key }),
      setMetadata: ({ threadId, key, value }) => this.writeThreadMetadataValue({ threadId, key, value }),
      deleteMetadata: ({ threadId, key }) => this.removeThreadMetadataValue({ threadId, key }),
      hasStorage: () => !!this.#resolveStorage(),
      saveThread: ({ thread }) => this.persistThreadRow(thread),
      deleteThread: ({ threadId }) => this.deleteThreadRow(threadId),
      cloneThread: ({ sourceThreadId, resourceId, title }) =>
        this.cloneThreadRow(session, { sourceThreadId, resourceId, title }),
      acquireLock: threadId => this.config.threadLock?.acquire(threadId) ?? Promise.resolve(),
      releaseLock: threadId => this.config.threadLock?.release(threadId) ?? Promise.resolve(),
      getModeIds: () => this.config.modes.map(m => m.id),
    };
  }

  /** Persist a thread row to memory storage (gateway primitive for the Session thread domain). */
  private async persistThreadRow(thread: HarnessThread): Promise<void> {
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
  private async cloneThreadRow(
    session: Session<TState>,
    {
      sourceThreadId,
      resourceId,
      title,
    }: {
      sourceThreadId: string;
      resourceId: string;
      title?: string;
    },
  ): Promise<HarnessThread> {
    if (!this.config.memory) {
      throw new Error('Memory is not configured on this Harness');
    }
    const memory = await this.resolveMemory(session);
    const result = await memory.cloneThread({ sourceThreadId, resourceId, title });
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

  private async queryThreadById({ threadId }: { threadId: string }): Promise<HarnessThread | null> {
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

  private async queryThreads({
    resourceId,
    includeForkedSubagents,
  }: {
    resourceId?: string;
    includeForkedSubagents?: boolean;
  }): Promise<HarnessThread[]> {
    if (!this.#resolveStorage()) return [];

    const memoryStorage = await this.getMemoryStorage();
    const filter: { resourceId?: string } | undefined = resourceId === undefined ? undefined : { resourceId };

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

  private async queryThreadMessages({
    threadId,
    limit,
  }: {
    threadId: string;
    limit?: number;
  }): Promise<HarnessMessage[]> {
    if (!this.#resolveStorage()) return [];

    const memoryStorage = await this.getMemoryStorage();

    if (limit) {
      const result = await memoryStorage.listMessages({
        threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages.map(msg => this.convertToHarnessMessage(msg)).reverse();
    }

    const result = await memoryStorage.listMessages({ threadId, perPage: false });
    return result.messages.map(msg => this.convertToHarnessMessage(msg));
  }

  private async queryFirstUserMessages({ threadIds }: { threadIds: string[] }): Promise<Map<string, HarnessMessage>> {
    if (!this.#resolveStorage() || threadIds.length === 0) return new Map();

    const memoryStorage = await this.getMemoryStorage();
    const result = await memoryStorage.listMessages({
      threadId: threadIds,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    const firstUserMessages = new Map<string, HarnessMessage>();
    for (const message of result.messages) {
      if (message.role !== 'user' || !message.threadId || firstUserMessages.has(message.threadId)) continue;
      firstUserMessages.set(message.threadId, this.convertToHarnessMessage(message));

      if (firstUserMessages.size === threadIds.length) {
        break;
      }
    }

    return firstUserMessages;
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  listModes(): HarnessMode[] {
    return this.config.modes;
  }

  private propagateRuntimeServicesToAgent(agent: Agent): Agent {
    const workspaceForAgents = this.workspaceFn ?? this.workspace;
    const browserForAgents = this.browserFn ?? this.browser;

    if (this.config.memory && !agent.hasOwnMemory()) {
      agent.__setMemory(this.config.memory);
    }
    if (workspaceForAgents && !agent.hasOwnWorkspace()) {
      agent.__setWorkspace(workspaceForAgents);
    }
    if (browserForAgents && !agent.hasOwnBrowser()) {
      agent.setBrowser(browserForAgents as MastraBrowser);
    }
    if (this.config.pubsub && !agent.hasOwnPubSub()) {
      agent.__setPubSub(this.config.pubsub);
    }

    // Register the agent on the resolved Mastra (the parent when registered,
    // otherwise the internal one). Re-bind when the agent currently has no
    // Mastra OR is bound to a different instance — e.g. an agent that built its
    // own internal Mastra before this Harness was registered on a parent.
    const mastra = this.getMastra();
    if (mastra && agent.getMastraInstance() !== mastra) {
      mastra.addAgent(agent);
    }

    return agent;
  }

  private getAgentForMode(mode: HarnessMode): Agent<any, any, any, any> {
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

    return this.propagateRuntimeServicesToAgent(this.getAgentForMode(mode));
  }

  /**
   * Check if the current model's provider has authentication configured.
   * Delegates to the {@link GatewayManager} auth chain (the same resolution
   * the model router uses at run time). Falls back to `hasAuth: true` when
   * no model is selected or the chain cannot resolve auth.
   */
  async getCurrentModelAuthStatus(session: Session<TState>): Promise<ModelAuthStatus> {
    const modelId = session.model.get();
    if (!modelId) return { hasAuth: true };

    const hasAuth = this.#gatewayManager ? await this.#gatewayManager.hasAuth(modelId) : true;
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
   * lives on the session (`session.identity`); the Harness orchestrates the
   * surrounding teardown — dropping the current thread subscription and clearing
   * the active thread — since those are Harness-owned.
   */
  async setResourceId(session: Session<TState>, { resourceId }: { resourceId: string }): Promise<void> {
    const previousResourceId = session.identity.getResourceId();
    session.thread.cleanupSubscription();
    session.identity.setResourceId({ resourceId });
    const releasePreviousThreadLock = session.thread.clearAndReleaseLock();

    // Re-key the resource registry so this session is the one resolved for its
    // new resourceId (and is no longer resolved for the old one). This session
    // becomes the authoritative owner of the target resource, replacing any
    // prior session registered there.
    const dropPreviousResource = this.#dropSessionFromRegistry(previousResourceId, session);
    this.#sessionsByResource.set(resourceId, Promise.resolve(session));
    await releasePreviousThreadLock;
    await dropPreviousResource;
  }

  /** Remove `resourceId` from the registry only if it still resolves to `session`. */
  async #dropSessionFromRegistry(resourceId: string, session: Session<TState>): Promise<void> {
    const pending = this.#sessionsByResource.get(resourceId);
    if (!pending) return;
    const resolved = await pending.catch(() => undefined);
    if (resolved === session && this.#sessionsByResource.get(resourceId) === pending) {
      this.#sessionsByResource.delete(resourceId);
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
   * Reads the OM record and recent messages to reconstruct status,
   * then emits an `om_status` event for the UI.
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
            observationThreshold?: number | { min: number; max: number };
            reflectionThreshold?: number | { min: number; max: number };
          }
        | undefined;

      const getThreshold = (val: number | { min: number; max: number } | undefined, fallback: number): number => {
        if (!val) return fallback;
        if (typeof val === 'number') return val;
        return val.max;
      };

      let observationThreshold = getThreshold(config?.observationThreshold, 30_000);
      let reflectionThreshold = getThreshold(config?.reflectionThreshold, 40_000);

      let messageTokens = record.pendingMessageTokens ?? 0;
      let observationTokens = record.observationTokenCount ?? 0;
      let bufferedObs = {
        status: 'idle' as 'idle' | 'running' | 'complete',
        chunks: 0,
        messageTokens: 0,
        projectedMessageRemoval: 0,
        observationTokens: 0,
      };
      let bufferedRef = {
        status: 'idle' as 'idle' | 'running' | 'complete',
        inputObservationTokens: 0,
        observationTokens: 0,
      };
      let generationCount = 0;
      let stepNumber = 0;

      const messagesResult = await memoryStorage.listMessages({
        threadId,
        perPage: 70,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      const messages = messagesResult.messages;
      let foundStatus = false;
      for (const msg of messages) {
        if (msg.role !== 'assistant') continue;
        const content = msg.content as { parts?: Array<{ type?: string; data?: Record<string, unknown> }> } | string;
        if (typeof content === 'string' || !content?.parts) continue;

        for (let i = content.parts.length - 1; i >= 0; i--) {
          const part = content.parts[i] as { type?: string; data?: Record<string, unknown> };
          if (part.type === 'data-om-status' && part.data?.windows) {
            const w = part.data.windows as Record<string, Record<string, Record<string, unknown>>>;
            messageTokens = (w.active?.messages?.tokens as number) ?? messageTokens;
            observationTokens = (w.active?.observations?.tokens as number) ?? observationTokens;
            const msgThresh = w.active?.messages?.threshold as number | undefined;
            const obsThresh = w.active?.observations?.threshold as number | undefined;
            if (msgThresh) observationThreshold = msgThresh;
            if (obsThresh) reflectionThreshold = obsThresh;
            const bo = w.buffered?.observations as Record<string, unknown> | undefined;
            if (bo) {
              bufferedObs = {
                status: (bo.status as 'idle' | 'running' | 'complete') ?? 'idle',
                chunks: (bo.chunks as number) ?? 0,
                messageTokens: (bo.messageTokens as number) ?? 0,
                projectedMessageRemoval: (bo.projectedMessageRemoval as number) ?? 0,
                observationTokens: (bo.observationTokens as number) ?? 0,
              };
            }
            const br = w.buffered?.reflection as Record<string, unknown> | undefined;
            if (br) {
              bufferedRef = {
                status: (br.status as 'idle' | 'running' | 'complete') ?? 'idle',
                inputObservationTokens: (br.inputObservationTokens as number) ?? 0,
                observationTokens: (br.observationTokens as number) ?? 0,
              };
            }
            generationCount = (part.data.generationCount as number) ?? 0;
            stepNumber = (part.data.stepNumber as number) ?? 0;
            foundStatus = true;
            break;
          }
        }
        if (foundStatus) break;
      }

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
    if (!session.thread.getId()) {
      throw new Error('Cannot build stream options without a current thread');
    }

    session.run.clearAbortRequested();
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
      memory: { thread: session.thread.getId(), resource: session.identity.getResourceId() },
      abortSignal: session.run.ensureAbortController().signal,
      requestContext,
      ...(tracingContext && { tracingContext }),
      ...(tracingOptions && { tracingOptions }),
      ...(callTimeInstructions && { instructions: callTimeInstructions }),
    };
    streamOptions.toolsets = await this.buildToolsets(session, requestContext);

    return streamOptions;
  }

  /**
   * Options that every harness-driven agent run must carry — the initial stream
   * AND every `resumeStream`. Centralized so the two paths can't drift: a
   * missing `maxSteps` on resume silently caps the resumed run at the agent's
   * small default and ends it mid-task (see {@link HARNESS_MAX_STEPS}).
   */
  private buildSharedRunOptions(session: Session<TState>): Record<string, unknown> {
    const isYolo = (session.state.get() as Record<string, unknown>).yolo === true;
    const shared: Record<string, unknown> = {
      maxSteps: HARNESS_MAX_STEPS,
      savePerStep: false,
      requireToolApproval: !isYolo,
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
   * calling. Returns the saved message converted to {@link HarnessMessage}.
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
  }): Promise<HarnessMessage | null> {
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
    return this.convertToHarnessMessage(saved);
  }

  /**
   * Resolve the mode the session transitions to when a plan is approved: the
   * current mode's `transitionsTo`, else the configured default mode. The mode
   * catalog is Harness config, so this is host-owned. Returns `undefined` when
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

  private convertToHarnessMessage(msg: {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'signal';
    createdAt: Date;
    content: {
      content?: string;
      parts: Array<{
        type: string;
        text?: string;
        reasoning?: string;
        toolCallId?: string;
        toolName?: string;
        args?: unknown;
        result?: unknown;
        isError?: boolean;
        toolInvocation?: {
          state: string;
          toolCallId: string;
          toolName: string;
          args?: unknown;
          result?: unknown;
          isError?: boolean;
        };
        [key: string]: unknown;
      }>;
      metadata?: Record<string, unknown>;
    };
  }): HarnessMessage {
    const content: HarnessMessageContent[] = [];
    const systemReminder = getRecordValue(msg.content.metadata?.systemReminder);

    if (systemReminder && typeof systemReminder.type === 'string') {
      const reminder = toSystemReminderContent({
        ...systemReminder,
        contents: typeof systemReminder.message === 'string' ? systemReminder.message : '',
        reminderType: systemReminder.type,
      });
      if (reminder) {
        content.push(reminder);
      }

      return {
        id: msg.id,
        role: msg.role === 'signal' ? 'user' : msg.role,
        content,
        createdAt: msg.createdAt,
      };
    }

    if (msg.role === 'signal') {
      const signal = mastraDBMessageToSignal(msg as MastraDBMessage);

      if (signal.type === 'user') {
        const signalContent = signalContentsToHarnessContent(signal.contents);
        if (signalContent.length > 0) {
          return {
            id: msg.id,
            role: 'user',
            content: signalContent,
            createdAt: msg.createdAt,
            attributes: signal.attributes,
          };
        }
      }

      if (signal.type === 'state') {
        const stateSignal = toStateSignalContent({
          id: signal.id,
          type: signal.type,
          tagName: signal.tagName,
          contents: signal.contents,
          metadata: signal.metadata,
        });
        if (stateSignal) {
          content.push(stateSignal);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'reactive' && signal.tagName === 'system-reminder') {
        const reminder = toSystemReminderContent({
          type: signal.type,
          contents: signalContentsToText(signal.contents),
          attributes: signal.attributes ?? msg.content.metadata,
          metadata: signal.metadata,
        });
        if (reminder) {
          content.push(reminder);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'notification' && signal.tagName === 'notification-summary') {
        const notificationSummary = toNotificationSummaryContent({
          id: signal.id,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
        });
        if (notificationSummary) {
          content.push(notificationSummary);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'notification' && signal.tagName === 'notification') {
        const notification = toNotificationContent({
          id: signal.id,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
        });
        if (notification) {
          content.push(notification);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'reactive') {
        const reactiveSignal = toReactiveSignalContent({
          id: signal.id,
          type: signal.type,
          tagName: signal.tagName,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
        });
        if (reactiveSignal) {
          content.push(reactiveSignal);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }
    }

    for (const part of msg.content.parts) {
      switch (part.type) {
        case 'text':
          if (part.text) {
            content.push({ type: 'text', text: part.text });
          }
          break;
        case 'reasoning':
          if (part.reasoning) {
            content.push({ type: 'thinking', thinking: part.reasoning });
          }
          break;
        case 'tool-invocation':
          if (part.toolInvocation) {
            const inv = part.toolInvocation;
            content.push({ type: 'tool_call', id: inv.toolCallId, name: inv.toolName, args: inv.args });
            if (inv.state === 'result' && inv.result !== undefined) {
              const partProviderMetadata = part.providerMetadata as Record<string, unknown> | undefined;
              content.push({
                type: 'tool_result',
                id: inv.toolCallId,
                name: inv.toolName,
                result: inv.result,
                isError: inv.isError ?? false,
                ...(partProviderMetadata ? { providerMetadata: partProviderMetadata } : {}),
              });
            }
          } else if (part.toolCallId && part.toolName) {
            content.push({ type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.args });
          }
          break;
        case 'tool-call':
          if (part.toolCallId && part.toolName) {
            content.push({ type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.args });
          }
          break;
        case 'tool-result':
          if (part.toolCallId && part.toolName) {
            const resultProviderMetadata = part.providerMetadata as Record<string, unknown> | undefined;
            content.push({
              type: 'tool_result',
              id: part.toolCallId,
              name: part.toolName,
              result: part.result,
              isError: part.isError ?? false,
              ...(resultProviderMetadata ? { providerMetadata: resultProviderMetadata } : {}),
            });
          }
          break;
        case 'data-om-observation-start': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          content.push({
            type: 'om_observation_start',
            tokensToObserve: (data.tokensToObserve as number) ?? 0,
            operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
          });
          break;
        }
        case 'data-om-observation-end': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          content.push({
            type: 'om_observation_end',
            tokensObserved: (data.tokensObserved as number) ?? 0,
            observationTokens: (data.observationTokens as number) ?? 0,
            durationMs: (data.durationMs as number) ?? 0,
            operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
            observations: (data.observations as string) ?? undefined,
            currentTask: (data.currentTask as string) ?? undefined,
            suggestedResponse: (data.suggestedResponse as string) ?? undefined,
          });
          break;
        }
        case 'data-om-observation-failed': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          content.push({
            type: 'om_observation_failed',
            error: (data.error as string) ?? 'Unknown error',
            tokensAttempted: (data.tokensAttempted as number) ?? 0,
            operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
          });
          break;
        }
        case 'data-signal': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          if (data.type === 'state') {
            const stateSignal = toStateSignalContent(data);
            if (stateSignal) content.push(stateSignal);
          } else if (data.type === 'reactive' && data.tagName === 'system-reminder') {
            const reminder = toSystemReminderContent(data);
            if (reminder) content.push(reminder);
          } else if (data.type === 'notification' && data.tagName === 'notification-summary') {
            const notificationSummary = toNotificationSummaryContent(data);
            if (notificationSummary) content.push(notificationSummary);
          } else if (data.type === 'notification' && data.tagName === 'notification') {
            const notification = toNotificationContent(data);
            if (notification) content.push(notification);
          } else if (data.type === 'reactive') {
            const reactiveSignal = toReactiveSignalContent(data);
            if (reactiveSignal) content.push(reactiveSignal);
          }
          break;
        }
        case 'data-user-message': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          const message = toUserSignalMessage(data);
          if (message) {
            content.push(...message.content);
          }
          break;
        }
        // Back-compat: persisted streams may still contain data-system-reminder parts
        case 'data-system-reminder': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          const reminder = toSystemReminderContent(data);
          if (reminder) {
            content.push(reminder);
          }
          break;
        }
        case 'file':
          if (typeof part.data !== 'string') {
            console.warn('[Harness] Skipping file part with non-string data:', typeof part.data);
            break;
          }
          content.push({
            type: 'file',
            data: part.data,
            mediaType:
              (part as { mediaType?: string }).mediaType ??
              (part as { mimeType?: string }).mimeType ??
              'application/octet-stream',
            ...((part as { filename?: string }).filename ? { filename: (part as { filename?: string }).filename } : {}),
          });
          break;
        case 'image': {
          const imgData =
            typeof part.data === 'string'
              ? part.data
              : typeof (part as { image?: string }).image === 'string'
                ? (part as { image?: string }).image!
                : '';
          content.push({
            type: 'image',
            data: imgData,
            mimeType:
              (part as { mimeType?: string }).mimeType ?? (part as { mediaType?: string }).mediaType ?? 'image/png',
          });
          break;
        }
        case 'data-om-thread-update': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          if (data.newTitle) {
            content.push({
              type: 'om_thread_title_updated',
              threadId: (data.threadId as string) ?? '',
              oldTitle: (data.oldTitle as string) ?? undefined,
              newTitle: data.newTitle as string,
            });
          }
          break;
        }
        // Skip other part types (step-start, data-om-status, etc.)
      }
    }

    return { id: msg.id, role: msg.role === 'signal' ? 'user' : msg.role, content, createdAt: msg.createdAt };
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

    // Resolve user-configured harness tools (needed for both the harness toolset and subagent allowedHarnessTools)
    let resolvedHarnessTools: ToolsInput | undefined = undefined;
    if (this.config.tools) {
      const tools =
        typeof this.config.tools === 'function' ? await this.config.tools({ requestContext }) : this.config.tools;
      if (tools) {
        resolvedHarnessTools = { ...tools };
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
        harnessTools: resolvedHarnessTools,
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
        // (not via Harness.cloneThread) so the parent thread stays the active
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
        delete resolvedHarnessTools?.[toolId];
      }
    }

    const result: ToolsetsInput = { harnessBuiltIn: builtInTools };
    if (resolvedHarnessTools) {
      result.harness = resolvedHarnessTools;
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
   * Tools can access harness state via requestContext.get('harness').
   */
  private async buildRequestContext(
    session: Session<TState>,
    requestContext?: RequestContext,
  ): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const harnessContext: HarnessRequestContext<TState> = {
      harnessId: this.id,
      state: session.state.get(),
      getState: () => session.state.get(),
      setState: updates => session.state.set(updates),
      updateState: updater => session.state.update(updater),
      threadId: session.thread.getId(),
      resourceId: session.identity.getResourceId(),
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
      workspace: this.workspace,
      emitEvent: event => session.emit(event),
      getSubagentModelId: params => session.subagents.model.get(params ?? {}),
    };

    requestContext.set('harness', harnessContext);

    if (this.workspaceFn) {
      // Pass the internal Mastra instance so the workspace factory can dedupe
      // against the registered workspace (getWorkspaceById). Without it, a
      // dynamic factory would build a *separate* Workspace/filesystem instance
      // from the one the agent resolves and registers — leaving harness-side
      // tools (e.g. request_access) mutating a different filesystem than the
      // agent's workspace tools (e.g. view) read from.
      const resolved = await Promise.resolve(this.workspaceFn({ requestContext, mastra: this.getMastra() }));
      harnessContext.workspace = resolved;
      // Cache for getWorkspace() so callers outside request flow (e.g. /skills) can access it
      this.workspace = resolved;
    }

    return requestContext;
  }

  /**
   * Resolve memory from config — handles both static instances and dynamic factory functions.
   */
  private async resolveMemory(session: Session<TState>): Promise<MastraMemory> {
    const mem = this.config.memory;
    if (!mem) {
      throw new Error('Memory is not configured on this Harness');
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
  // Workspace
  // ===========================================================================

  getWorkspace(): Workspace | undefined {
    return this.workspace;
  }

  /**
   * Eagerly resolve the workspace. For dynamic workspaces (factory function),
   * this triggers resolution and caches the result so getWorkspace() returns it.
   * Useful for code paths outside the request flow (e.g. slash commands).
   */
  async resolveWorkspace({
    session,
    requestContext,
  }: {
    session: Session<TState>;
    requestContext?: RequestContext;
  }): Promise<Workspace | undefined> {
    if (this.workspace) return this.workspace;
    if (this.workspaceFn) {
      // buildRequestContext resolves the workspace and caches it on this.workspace
      await this.buildRequestContext(session, requestContext);
      return this.workspace;
    }
    return undefined;
  }

  hasWorkspace(): boolean {
    return this.config.workspace !== undefined;
  }

  isWorkspaceReady(): boolean {
    if (this.workspaceFn) return true;
    return this.workspaceInitialized && this.workspace !== undefined;
  }

  async destroyWorkspace(): Promise<void> {
    if (this.workspaceFn) return;
    if (this.workspace && this.workspaceInitialized) {
      // The workspace is a Harness-shared resource torn down at Harness
      // shutdown; there is no single session to emit lifecycle events onto.
      try {
        await this.workspace.destroy();
      } catch (error) {
        console.warn('Workspace destroy failed:', error);
      } finally {
        this.workspaceInitialized = false;
      }
    }
  }

  // ===========================================================================
  // Heartbeat Handlers
  // ===========================================================================

  private startHeartbeats(): void {
    const handlers = [...(this.config.heartbeatHandlers ?? [])];
    if (!handlers.length) return;

    for (const hb of handlers) {
      if (this.heartbeatTimers.has(hb.id)) continue;

      const run = async () => {
        try {
          await hb.handler();
        } catch (error) {
          console.error(`[Heartbeat:${hb.id}] failed:`, error);
        }
      };

      if (hb.immediate !== false) {
        void run();
      }

      const timer = setInterval(run, hb.intervalMs);
      timer.unref();
      this.heartbeatTimers.set(hb.id, { timer, shutdown: hb.shutdown });
    }
  }

  registerHeartbeat(handler: HeartbeatHandler): void {
    void this.removeHeartbeat({ id: handler.id });

    const run = async () => {
      try {
        await handler.handler();
      } catch (error) {
        console.error(`[Heartbeat:${handler.id}] failed:`, error);
      }
    };

    if (handler.immediate !== false) {
      void run();
    }

    const timer = setInterval(run, handler.intervalMs);
    timer.unref();
    this.heartbeatTimers.set(handler.id, { timer, shutdown: handler.shutdown });
  }

  async removeHeartbeat({ id }: { id: string }): Promise<void> {
    const entry = this.heartbeatTimers.get(id);
    if (entry) {
      clearInterval(entry.timer);
      this.heartbeatTimers.delete(id);
      try {
        await entry.shutdown?.();
      } catch (error) {
        console.error(`[Heartbeat:${id}] shutdown failed:`, error);
      }
    }
  }

  async stopHeartbeats(): Promise<void> {
    const entries = [...this.heartbeatTimers.entries()];
    this.heartbeatTimers.clear();

    for (const [id, entry] of entries) {
      clearInterval(entry.timer);
      try {
        await entry.shutdown?.();
      } catch (error) {
        console.error(`[Heartbeat:${id}] shutdown failed:`, error);
      }
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async destroy(): Promise<void> {
    // The Harness owns no session; per-session teardown (thread-subscription
    // cleanup) is the caller's responsibility via `session.thread.*`. Here we
    // only tear down Harness-shared resources.
    await this.stopHeartbeats();
    await this.destroyWorkspace();
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
