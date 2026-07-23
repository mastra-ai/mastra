import { randomUUID } from 'node:crypto';

import { Agent } from '../agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '../agent/message-list/state/types';
import type { AgentInstructions, ToolsInput, ToolsetsInput } from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
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
import type { DynamicArgument } from '../types';
import { Workspace } from '../workspace/workspace';
import type { WorkspaceConfig } from '../workspace/workspace';

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
  private workspaceInitialized = false;
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

  constructor(config: AgentControllerConfig<TState>) {
    validateModes(config.modes);

    this.id = config.id;
    this.config = config;
    this.#instructions = config.instructions;
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

    // Get-or-create: a (resourceId, scope) pair maps to exactly one durable
    // session per AgentController. Asking for the same resource+scope twice returns
    // the same session, so a user/thread always resumes their own session and
    // notification delivery reuses it rather than spawning a split-brain
    // duplicate. Cache the in-flight promise so concurrent calls for the same
    // resource+scope resolve to one session.
    const existing = this.#sessionsByResource.get(registryKey);
    if (existing) {
      return existing;
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
        workspace: workspaceToConnect as Workspace,
        browser: browserToConnect,
      }),
    );

    if (workspaceToConnect && workspaceToConnect instanceof Workspace) {
      try {
        await workspaceToConnect.init();
        session.emit({ type: 'workspace_status_changed', status: 'ready' });
        session.emit({
          type: 'workspace_ready',
          workspaceId: workspaceToConnect.id,
          workspaceName: workspaceToConnect.name,
        });
      } catch (error) {
        const initError = getErrorFromUnknown(error);
        session.emit({ type: 'workspace_status_changed', status: 'error', error: initError });
        session.emit({ type: 'workspace_error', error: initError });
      }
    }

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
      // Bring the session online with a current thread. Selection is tag-aware so
      // worktrees sharing a resourceId each resume their own thread without
      // claiming threads owned by another scope. A thread is a candidate only when
      // its metadata matches every provided tag; with no tags every thread
      // qualifies. Tags default to the controller-global state when omitted.
      const selectionTags: Record<string, string> = {};
      if (tags && Object.keys(tags).length > 0) {
        Object.assign(selectionTags, tags);
      } else {
        const projectPath = (this.config.initialState as any)?.projectPath as string | undefined;
        if (projectPath) selectionTags.projectPath = projectPath;
      }
      const tagEntries = Object.entries(selectionTags);

      const threads = await session.thread.list();
      const candidates =
        tagEntries.length > 0
          ? threads.filter(t => {
              const metadata = (t.metadata as Record<string, unknown> | undefined) ?? {};
              return tagEntries.every(([key, value]) => metadata[key] === value);
            })
          : threads;

      // Resume the most recent same-resource candidate, or create a new thread.
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
   * Whether the AgentController-level static workspace has been initialized. Dynamic
   * factory workspaces are resolved and initialized per-session during
   * `createSession`, so this returns `false` for factory configs until a
   * session is created.
   */
  isWorkspaceReady(): boolean {
    if (typeof this.workspace === 'function') return true;
    return this.workspaceInitialized && this.workspace !== undefined;
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
   * Eagerly resolve the workspace. For dynamic workspaces (factory function),
   * this triggers resolution against the given session's request context and
   * caches the result so {@link getWorkspace} returns it. Useful for code paths
   * outside the request flow (e.g. slash commands).
   */
  async resolveWorkspace({
    session,
    requestContext,
  }: {
    session: Session<TState>;
    requestContext?: RequestContext;
  }): Promise<Workspace | undefined> {
    if (typeof this.workspace !== 'function') return this.workspace ?? undefined;
    const ctx = await this.buildRequestContext(session, requestContext);
    const resolved = await this.workspace({ requestContext: ctx, mastra: this.getMastra() });
    this.workspace = resolved;
    return resolved ?? undefined;
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
        ...(this.config.backgroundTasks ? { backgroundTasks: this.config.backgroundTasks } : {}),
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
    if (this.config.workspace && !this.workspaceInitialized && typeof this.workspace !== 'function') {
      try {
        if (!this.workspace) {
          this.workspace = new Workspace(this.config.workspace as WorkspaceConfig);
        }

        await (this.workspace as Workspace).init();
        this.workspaceInitialized = true;
      } catch {
        this.workspace = undefined;
        this.workspaceInitialized = false;
        // Sessions created later will call workspace.init() themselves and
        // surface the error through workspace_error events on the session.
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

  private async queryThreadById({ threadId }: { threadId: string }): Promise<AgentControllerThread | null> {
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
    metadata,
  }: {
    resourceId?: string;
    includeForkedSubagents?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<AgentControllerThread[]> {
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

  private async queryThreadMessages({
    threadId,
    limit,
  }: {
    threadId: string;
    limit?: number;
  }): Promise<MastraDBMessage[]> {
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
      if (message.role !== 'user' || !message.threadId || firstUserMessages.has(message.threadId)) continue;
      firstUserMessages.set(message.threadId, this.convertToControllerMessage(message));

      if (firstUserMessages.size === threadIds.length) {
        break;
      }
    }

    return firstUserMessages;
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

    return agent;
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
   */
  async setResourceId(session: Session<TState>, { resourceId }: { resourceId: string }): Promise<void> {
    const previousResourceId = session.identity.getResourceId();
    session.thread.cleanupSubscription();
    session.identity.setResourceId({ resourceId });
    const releasePreviousThreadLock = session.thread.clearAndReleaseLock();

    // Re-key the resource registry so this session is the one resolved for its
    // new resourceId (and is no longer resolved for the old one). This session
    // becomes the authoritative owner of the target resource, replacing any
    // prior session registered there. The session keeps its creation scope, so
    // a scoped session re-keys under the same scope on the new resource.
    const scope = this.#sessionScopes.get(session);
    const dropPreviousResource = this.#dropSessionFromRegistry(sessionRegistryKey(previousResourceId, scope), session);
    this.#sessionsByResource.set(sessionRegistryKey(resourceId, scope), Promise.resolve(session));
    await releasePreviousThreadLock;
    await dropPreviousResource;
  }

  /** Remove `registryKey` from the registry only if it still resolves to `session`. */
  async #dropSessionFromRegistry(registryKey: string, session: Session<TState>): Promise<void> {
    const pending = this.#sessionsByResource.get(registryKey);
    if (!pending) return;
    const resolved = await pending.catch(() => undefined);
    if (resolved === session && this.#sessionsByResource.get(registryKey) === pending) {
      this.#sessionsByResource.delete(registryKey);
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
    untilIdle,
  }: {
    session: Session<TState>;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    untilIdle?: boolean | { maxIdleMs?: number };
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
      ...(untilIdle && { untilIdle }),
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
    const shared: Record<string, unknown> = {
      maxSteps: CONTROLLER_MAX_STEPS,
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
