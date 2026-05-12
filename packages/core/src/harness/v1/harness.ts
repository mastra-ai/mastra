/**
 * Harness v1 — top-level entry point.
 *
 * See HARNESS_V1_SPEC.md §4 for the full surface. This module currently
 * implements the "resolver + lifecycle" slice (M1):
 *
 *   - `new Harness(config)` validates modes/agents and binds storage.
 *   - `harness.session(opts)` finds-or-creates sessions per §5.3, acquiring
 *     the durable lease and hydrating from `HarnessStorage`.
 *   - `harness.closeSession`, `harness.listSessions`, `harness.shutdown`
 *     handle the lifecycle paths needed for that slice.
 *
 * Everything else (message, queue, attachments, threads, intervals, …) is
 * still a stub and throws "not implemented".
 */

import { randomUUID } from 'node:crypto';

import type { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import type {
  HarnessStorage,
  PermissionRules,
  SessionGrants,
  SessionRecord,
  SessionSummary,
  TokenUsage,
} from '../../storage/domains/harness';
import {
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from '../../storage/domains/harness';

import { InMemoryStore } from '../../storage/mock';
import type { Workspace } from '../../workspace';

import {
  HarnessConfigError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessThreadNotFoundError,
  HarnessWorkspaceProviderMismatchError,
} from './errors';
import { EventEmitter } from './events';
import type { HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe } from './events';
import { Session } from './session';
import type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  HarnessConfig,
  HarnessMode,
  PermissionPolicy,
  SessionListOptions,
  SessionLoadByIdOptions,
  SessionResolveOptions,
  ShutdownOptions,
  SubagentDefinition,
  ThreadCloneOptions,
  ThreadCreateOptions,
  ThreadDeleteOptions,
  ThreadGetOptions,
  ThreadListOptions,
  ThreadListResult,
  ThreadRecord,
  ThreadRenameOptions,
  ThreadSelectOrCreateOptions,
  ToolCategory,
} from './types';
import { WorkspaceRegistry } from './workspace-registry';

const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_QUEUE_DEPTH = 100;
const DEFAULT_SUBAGENT_MAX_DEPTH = 1;
const DEFAULT_GOAL_MAX_TURNS = 50;
const DEFAULT_PERMISSION_POLICY: PermissionPolicy = 'ask';

export class Harness {
  /** Process-scoped owner id used as the lease holder for all sessions. */
  readonly ownerId: string;

  /**
   * The Mastra instance backing this harness. Either supplied at
   * construction (`new Harness({ mastra })`), built internally from
   * inline `agents`/`storage`, or installed by `__registerMastra(parent)`
   * when the harness is registered as a child of a parent Mastra.
   *
   * Reads of agents and storage always go through this. Tools and
   * primitives that need the harness's Mastra (TUI, server) read it via
   * `harness.mastra`.
   */
  private _mastra?: Mastra;
  private readonly _storageOverride?: HarnessStorage;
  private readonly _modesById: Map<string, HarnessMode>;
  private readonly _defaultModeId?: string;
  private readonly _liveSessions = new Map<string, Session>();
  private readonly _leaseTtlMs: number;
  private readonly _maxQueueDepth: number;
  private readonly _subagentTypes: ReadonlyMap<string, SubagentDefinition>;
  private readonly _subagentMaxDepth: number;
  private readonly _goalDefaults: { defaultJudgeModel?: string; defaultMaxTurns: number };
  private readonly _defaultPermissionPolicy: PermissionPolicy;
  private readonly _toolCategoryResolver?: (toolName: string) => ToolCategory | null;
  private readonly _emitter = new EventEmitter();
  /** Per-session unsubscribers so harness-level subscribers see session events too. */
  private readonly _sessionEventBridges = new Map<string, HarnessEventUnsubscribe>();
  /** Workspace registry — owns lifecycle across `shared`/`per-resource`/`per-session`. */
  readonly _workspaceRegistry: WorkspaceRegistry;
  /** Snapshot of the workspace kind for fast read paths. `undefined` when not configured. */
  readonly _workspaceKind?: 'shared' | 'per-resource' | 'per-session';

  private _shutdown = false;

  constructor(config: HarnessConfig) {
    this.ownerId = `harness-${randomUUID()}`;
    this._leaseTtlMs = DEFAULT_LEASE_TTL_MS;
    this._storageOverride = config.sessions?.storage;
    this._maxQueueDepth = config.sessions?.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH;
    if (this._maxQueueDepth < 1) {
      throw new HarnessConfigError('sessions.maxQueueDepth', 'must be a positive integer');
    }

    // Subagent registry. Shape validation up front (uniqueness, mutual
    // exclusion of tool overlays); agent-existence resolution happens at
    // _bindMastra so it matches how modes are validated.
    const subagentTypes = new Map<string, SubagentDefinition>();
    if (config.subagents) {
      for (const [agentType, def] of Object.entries(config.subagents.types ?? {})) {
        if (typeof def?.agentId !== 'string' || def.agentId.length === 0) {
          throw new HarnessConfigError(`subagents.types["${agentType}"].agentId`, 'is required');
        }
        if (typeof def.description !== 'string' || def.description.length === 0) {
          throw new HarnessConfigError(`subagents.types["${agentType}"].description`, 'is required');
        }
        subagentTypes.set(agentType, def);
      }
      this._subagentMaxDepth = config.subagents.maxDepth ?? DEFAULT_SUBAGENT_MAX_DEPTH;
      if (this._subagentMaxDepth < 1) {
        throw new HarnessConfigError('subagents.maxDepth', 'must be a positive integer');
      }
    } else {
      this._subagentMaxDepth = DEFAULT_SUBAGENT_MAX_DEPTH;
    }
    this._subagentTypes = subagentTypes;

    // Goal-loop defaults (§4.7). Optional; resolved per-call at setGoal().
    const goalsCfg = config.goals;
    if (goalsCfg?.defaultMaxTurns !== undefined && goalsCfg.defaultMaxTurns < 1) {
      throw new HarnessConfigError('goals.defaultMaxTurns', 'must be a positive integer');
    }
    this._goalDefaults = {
      ...(goalsCfg?.defaultJudgeModel !== undefined ? { defaultJudgeModel: goalsCfg.defaultJudgeModel } : {}),
      defaultMaxTurns: goalsCfg?.defaultMaxTurns ?? DEFAULT_GOAL_MAX_TURNS,
    };

    // Permission gate config (§4.2e).
    if (
      config.defaultPermissionPolicy !== undefined &&
      config.defaultPermissionPolicy !== 'allow' &&
      config.defaultPermissionPolicy !== 'ask' &&
      config.defaultPermissionPolicy !== 'deny'
    ) {
      throw new HarnessConfigError(
        'defaultPermissionPolicy',
        `must be one of 'allow' | 'ask' | 'deny' (received: ${JSON.stringify(config.defaultPermissionPolicy)})`,
      );
    }
    if (config.toolCategoryResolver !== undefined && typeof config.toolCategoryResolver !== 'function') {
      throw new HarnessConfigError('toolCategoryResolver', 'must be a function');
    }
    if (
      config.toolCategories !== undefined &&
      (typeof config.toolCategories !== 'object' ||
        config.toolCategories === null ||
        Array.isArray(config.toolCategories))
    ) {
      throw new HarnessConfigError('toolCategories', 'must be a Record<string, ToolCategory>');
    }
    this._defaultPermissionPolicy = config.defaultPermissionPolicy ?? DEFAULT_PERMISSION_POLICY;
    // `toolCategoryResolver` is primary; `toolCategories` is sugar that
    // desugars to `(name) => toolCategories[name] ?? null`. When both are
    // provided the resolver wins (§9.1 sugar contract).
    if (config.toolCategoryResolver) {
      this._toolCategoryResolver = config.toolCategoryResolver;
    } else if (config.toolCategories) {
      const map = config.toolCategories;
      this._toolCategoryResolver = (name: string) => map[name] ?? null;
    } else {
      this._toolCategoryResolver = undefined;
    }

    // Workspace (§2.7). Three ownership models; registry handles lifecycle.
    // Cross-checks against the subagent registry happen below.
    this._workspaceKind = config.workspace?.kind;
    this._workspaceRegistry = new WorkspaceRegistry({
      config: config.workspace,
      emitter: this._emitter,
    });

    // Eager provisioning for `kind: 'shared'`. Per-resource and per-session
    // are eagerly provisioned at session creation when `eager: true`
    // (handled in Session._resolve / Session._construct).
    if (config.workspace?.kind === 'shared' && config.workspace.eager) {
      void this._workspaceRegistry.acquireShared().catch(() => {
        // Errors surface through the workspace_error event; swallow here.
      });
    }

    // Subagent `workspace: 'fresh'` is only valid under `per-session`. Validate
    // at config time so misconfigurations don't reach the runtime spawn path.
    if (this._workspaceKind !== 'per-session') {
      for (const [agentType, def] of subagentTypes) {
        if (def.workspace === 'fresh') {
          throw new HarnessConfigError(
            `subagents.types["${agentType}"].workspace`,
            `"fresh" requires harness workspace kind "per-session" (current: "${this._workspaceKind ?? 'unconfigured'}")`,
          );
        }
      }
    }

    // Validate mode shape (uniqueness, tools/additionalTools mutual
    // exclusion, transitionsTo resolution) up front. Agent-existence
    // validation happens once a Mastra is bound — either here (if the
    // caller supplied one) or in __registerMastra.
    this._modesById = new Map();
    for (const mode of config.modes ?? []) {
      if (this._modesById.has(mode.id)) {
        throw new HarnessConfigError(`modes`, `duplicate mode id "${mode.id}"`);
      }
      if (mode.tools && mode.additionalTools) {
        throw new HarnessConfigError(
          `modes[${mode.id}]`,
          `cannot set both "tools" and "additionalTools" — choose replace OR augment`,
        );
      }
      this._modesById.set(mode.id, mode);
    }
    for (const mode of this._modesById.values()) {
      if (mode.transitionsTo && !this._modesById.has(mode.transitionsTo)) {
        throw new HarnessConfigError(
          `modes[${mode.id}].transitionsTo`,
          `references unknown mode "${mode.transitionsTo}"`,
        );
      }
    }

    if (config.defaultModeId !== undefined) {
      if (!this._modesById.has(config.defaultModeId)) {
        throw new HarnessConfigError(`defaultModeId`, `references unknown mode "${config.defaultModeId}"`);
      }
      this._defaultModeId = config.defaultModeId;
    } else if (this._modesById.size > 0) {
      throw new HarnessConfigError(`defaultModeId`, `must be set when "modes" is non-empty`);
    }

    // Resolve the Mastra binding. Three shapes:
    //   1. Caller passed a pre-built Mastra
    //   2. Caller passed inline agents (and optionally storage) — we build
    //      our own Mastra so the harness is fully self-contained. If no
    //      storage was supplied we default to InMemoryStore so that both
    //      the harness storage domain *and* the memory domain (used by
    //      thread CRUD) are available without the caller having to wire
    //      a composite by hand.
    //   3. Neither — defer; a parent Mastra will install itself via
    //      __registerMastra during its own construction.
    if (config.mastra) {
      this._bindMastra(config.mastra);
    } else if (config.agents !== undefined || config.storage !== undefined) {
      const storage = config.storage ?? new InMemoryStore();
      const internal = new Mastra({
        agents: config.agents,
        storage,
      });
      this._bindMastra(internal);
    }
    // Otherwise: stay unbound. session() will throw HarnessConfigError
    // with a clear message until the parent Mastra registers.
  }

  /**
   * The Mastra instance powering this harness. Throws if the harness has
   * not been bound to a Mastra yet (i.e., it was constructed with no
   * `mastra` / `agents` / `storage` and has not been registered onto a
   * parent Mastra). Once bound, the reference is stable for the harness's
   * lifetime.
   */
  get mastra(): Mastra {
    if (!this._mastra) {
      throw new HarnessConfigError(
        'mastra',
        'harness is not yet bound to a Mastra — pass `mastra`/`agents`/`storage` at construction or register it on a parent Mastra',
      );
    }
    return this._mastra;
  }

  /**
   * @internal — called by `Mastra` during its own construction when this
   * harness is registered under `harnesses.<name>`. Idempotent for the
   * same parent; throws if called twice with different parents.
   */
  __registerMastra(mastra: Mastra): void {
    if (this._mastra && this._mastra !== mastra) {
      throw new HarnessConfigError('mastra', 'harness is already bound to a different Mastra instance');
    }
    if (this._mastra === mastra) return;
    this._bindMastra(mastra);
  }

  /**
   * Validate every mode's `agentId` against the Mastra's agent registry
   * and stash the binding for runtime use.
   */
  private _bindMastra(mastra: Mastra): void {
    for (const mode of this._modesById.values()) {
      let agent: Agent | undefined;
      try {
        agent = mastra.getAgent(mode.agentId as never) as Agent | undefined;
      } catch {
        agent = undefined;
      }
      if (!agent) {
        throw new HarnessConfigError(
          `modes[${mode.id}].agentId`,
          `references unknown agent "${mode.agentId}" — Mastra has no such agent registered`,
        );
      }
    }
    for (const [agentType, def] of this._subagentTypes) {
      let agent: Agent | undefined;
      try {
        agent = mastra.getAgent(def.agentId as never) as Agent | undefined;
      } catch {
        agent = undefined;
      }
      if (!agent) {
        throw new HarnessConfigError(
          `subagents.types["${agentType}"].agentId`,
          `references unknown agent "${def.agentId}" — Mastra has no such agent registered`,
        );
      }
      if (def.modeId !== undefined && !this._modesById.has(def.modeId)) {
        throw new HarnessConfigError(
          `subagents.types["${agentType}"].modeId`,
          `references unknown mode "${def.modeId}"`,
        );
      }
    }
    this._mastra = mastra;
  }

  // -------------------------------------------------------------------------
  // Events — §10.
  // -------------------------------------------------------------------------

  /**
   * Subscribe to harness-scoped events. Includes lifecycle events for every
   * live session (session_created, session_closed, session_evicted) and any
   * harness-level custom events. Per-session turn events (agent_start,
   * message_*, tool_*, suspension_*, mode_changed, model_changed) are
   * forwarded here so a single subscriber can render the whole harness.
   * Per-turn events also include `message_*` (assistant text streaming) and
   * `tool_input_*` (model-side argument streaming) — see §10.2.
   *
   * Listeners see only future events.
   */
  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this._emitter.subscribe(listener);
  }

  /** @internal — listener count for tests. */
  _internalListenerCount(): number {
    return this._emitter.listenerCount;
  }

  // -------------------------------------------------------------------------
  // Workspace — §2.7 / §4.1.
  // -------------------------------------------------------------------------

  /**
   * Returns the shared workspace when the harness is configured with
   * `kind: 'shared'`. For `per-resource` and `per-session`, returns
   * `undefined` — those models don't have a meaningful harness-level
   * workspace. Tools should always go through `session.getWorkspace()`.
   *
   * The shared workspace materialises lazily on first call (or eagerly
   * during `init()` when `eager: true`).
   */
  async getWorkspace(): Promise<Workspace | undefined> {
    if (this._workspaceKind !== 'shared') return undefined;
    return this._workspaceRegistry.acquireShared();
  }

  /**
   * Tear down the workspace bound to a given resource. Only valid under
   * `kind: 'per-resource'`. Throws `HarnessWorkspaceInUseError` if any
   * sessions are still holding the workspace; callers are expected to
   * close them first.
   */
  async destroyResourceWorkspace(opts: { resourceId: string }): Promise<void> {
    if (this._workspaceKind !== 'per-resource') {
      throw new HarnessConfigError(
        'workspace.kind',
        `destroyResourceWorkspace requires kind: "per-resource" (current: "${this._workspaceKind ?? 'unconfigured'}")`,
      );
    }
    await this._workspaceRegistry.destroyResourceWorkspace(opts);
  }

  /** @internal — emit a harness-level event. Used by tests and helpers. */
  _emit(event: Parameters<EventEmitter['emit']>[0], overrides?: Parameters<EventEmitter['emit']>[1]): HarnessEvent {
    return this._emitter.emit(event, overrides);
  }

  /**
   * Resolve the backing `Agent` for a mode through the bound Mastra.
   * Throws if the harness is not yet bound.
   */
  getAgentForMode(modeId: string): Agent {
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('modeId', `unknown mode "${modeId}"`);
    }
    return this.mastra.getAgent(mode.agentId as never) as Agent;
  }

  /**
   * @internal — Session reads the subagent-type registry when wiring
   * the built-in `spawn_subagent` tool. Returns undefined for unknown
   * types so the tool can return a `HarnessValidationError`-shaped
   * payload rather than throwing through the agent stream.
   */
  _getSubagentType(agentType: string): SubagentDefinition | undefined {
    return this._subagentTypes.get(agentType);
  }

  /** @internal — Session reads this to render the `agentType` enum in the spawn tool's input schema. */
  _listSubagentTypeIds(): string[] {
    return Array.from(this._subagentTypes.keys());
  }

  /** @internal — Session enforces the subagent depth cap inside the spawn tool. */
  _getSubagentMaxDepth(): number {
    return this._subagentMaxDepth;
  }

  /** @internal — Session reads the resolved mode for per-turn overlays. */
  _getMode(modeId: string): HarnessMode {
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('modeId', `unknown mode "${modeId}"`);
    }
    return mode;
  }

  /**
   * Enumerate every mode registered on this harness, in declaration order.
   *
   * Returned array is a fresh copy — callers may sort or filter without
   * affecting harness state. Used by TUIs to render a mode picker and by
   * scripts that need to discover what modes exist before opening a session.
   */
  listModes(): HarnessMode[] {
    return Array.from(this._modesById.values());
  }

  /**
   * Look up a single mode by id. Returns `undefined` if no mode with that id
   * is registered. For the throwing variant used during request resolution,
   * see the internal `_getMode` helper.
   */
  getMode(modeId: string): HarnessMode | undefined {
    return this._modesById.get(modeId);
  }

  // -------------------------------------------------------------------------
  // Permission gate accessors — §4.2e.
  // -------------------------------------------------------------------------

  /**
   * Resolve a tool name to its category, using the resolver configured on
   * `HarnessConfig.toolCategoryResolver`. Returns `null` for tools with no
   * configured resolver or that the resolver explicitly leaves
   * uncategorised. Used by the permission gate and by TUIs that want to
   * render tools grouped by category.
   */
  getToolCategory(opts: { toolName: string }): ToolCategory | null {
    if (!this._toolCategoryResolver) return null;
    return this._toolCategoryResolver(opts.toolName) ?? null;
  }

  /** @internal — Session reads this as the floor when no per-tool / per-category rule applies. */
  _getDefaultPermissionPolicy(): PermissionPolicy {
    return this._defaultPermissionPolicy;
  }

  // -------------------------------------------------------------------------
  // Session resolver — §4.1, §5.3.
  // -------------------------------------------------------------------------

  async session(opts: SessionResolveOptions): Promise<Session> {
    if (this._shutdown) {
      throw new Error('Harness is shut down');
    }
    const storage = this._requireStorage('session()');

    // 1) sessionId-only lookups.
    if ('sessionId' in opts && opts.sessionId && !('threadId' in opts && opts.threadId)) {
      return this._resolveById(storage, opts.sessionId, opts.resourceId);
    }

    // 2) threadId resolution. May be `{ fresh: true }` to force a new thread.
    if ('threadId' in opts && opts.threadId !== undefined) {
      return this._resolveByThread(storage, opts);
    }

    // 3) resourceId-only resolution: most-recent active or create.
    if ('resourceId' in opts && opts.resourceId) {
      return this._resolveByResource(storage, opts);
    }

    throw new HarnessConfigError('session()', 'invalid resolver options');
  }

  private async _resolveById(storage: HarnessStorage, sessionId: string, resourceId?: string): Promise<Session> {
    // In-memory hit — return live instance, enforce resourceId scoping.
    const live = this._liveSessions.get(sessionId);
    if (live) {
      if (resourceId !== undefined && live.resourceId !== resourceId) {
        // Don't leak existence across tenants.
        throw new HarnessSessionNotFoundError(sessionId);
      }
      return live;
    }

    const stored = await storage.loadSession({ sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(sessionId);
    if (resourceId !== undefined && stored.resourceId !== resourceId) {
      // Cross-tenant existence is never leaked.
      throw new HarnessSessionNotFoundError(sessionId);
    }
    if (stored.closedAt !== undefined) {
      throw new HarnessSessionClosedError(sessionId);
    }

    return this._hydrate(storage, stored);
  }

  private async _resolveByThread(
    storage: HarnessStorage,
    opts: Extract<SessionResolveOptions, { threadId: any }>,
  ): Promise<Session> {
    const wantsFreshThread = typeof opts.threadId !== 'string';
    const resourceId = opts.resourceId!;

    if (wantsFreshThread) {
      // Force a brand-new thread + session. ownsThread = true so the cascade
      // can later tear the thread down with the session.
      return this._createFresh(storage, {
        resourceId,
        threadId: this._mintThreadId(),
        ownsThread: true,
        sessionId: opts.sessionId,
        parentSessionId: opts.parentSessionId,
        origin: opts.origin ?? 'top-level',
        modeId: opts.modeId,
        modelId: opts.modelId,
        subagentDepth: opts.subagentDepth,
      });
    }

    const threadId = opts.threadId as string;

    // In-memory hit by (threadId, resourceId)?
    for (const live of this._liveSessions.values()) {
      if (live.threadId === threadId && live.resourceId === resourceId) {
        // §5.3: deterministic-ID callers can pass `sessionId` alongside; if
        // the live one has a different id, prefer the explicit id and treat
        // the live one as a different session.
        if (opts.sessionId && live.id !== opts.sessionId) continue;
        return live;
      }
    }

    // Storage lookup — adapters filter out closed records.
    const stored = await storage.loadSessionByThread({ threadId, resourceId });
    if (stored) {
      if (opts.sessionId && stored.id !== opts.sessionId) {
        // Caller asked for a specific session id on this thread; the active
        // one in storage doesn't match — fall through to deterministic-id
        // create with the supplied id.
        return this._createFresh(storage, {
          resourceId,
          threadId,
          ownsThread: false,
          sessionId: opts.sessionId,
          parentSessionId: opts.parentSessionId,
          origin: opts.origin ?? 'top-level',
          modeId: opts.modeId,
          modelId: opts.modelId,
          subagentDepth: opts.subagentDepth,
        });
      }
      return this._hydrate(storage, stored);
    }

    // No active record — create a fresh session bound to this thread.
    return this._createFresh(storage, {
      resourceId,
      threadId,
      ownsThread: false,
      sessionId: opts.sessionId,
      parentSessionId: opts.parentSessionId,
      origin: opts.origin ?? 'top-level',
      modeId: opts.modeId,
      modelId: opts.modelId,
      subagentDepth: opts.subagentDepth,
    });
  }

  private async _resolveByResource(
    storage: HarnessStorage,
    opts: Extract<SessionResolveOptions, { resourceId: string }>,
  ): Promise<Session> {
    const resourceId = opts.resourceId!;

    // Most-recent live session for that resource wins, when present.
    let liveCandidate: Session | undefined;
    for (const live of this._liveSessions.values()) {
      if (live.resourceId !== resourceId) continue;
      if (!liveCandidate || live.lastActivityAt > liveCandidate.lastActivityAt) {
        liveCandidate = live;
      }
    }
    if (liveCandidate) return liveCandidate;

    const summaries = await storage.listSessions({ resourceId, includeClosed: false });
    const head = summaries[0];
    if (head) {
      // listSessions returns newest-first by lastActivityAt.
      const stored = await storage.loadSession({ sessionId: head.id });
      if (stored && stored.closedAt === undefined) {
        return this._hydrate(storage, stored);
      }
    }

    // Nothing active → fresh thread + session.
    return this._createFresh(storage, {
      resourceId,
      threadId: this._mintThreadId(),
      ownsThread: true,
      origin: opts.origin ?? 'top-level',
      modeId: opts.modeId,
      modelId: opts.modelId,
      parentSessionId: opts.parentSessionId,
      subagentDepth: opts.subagentDepth,
    });
  }

  // -------------------------------------------------------------------------
  // Session creation / hydration.
  // -------------------------------------------------------------------------

  private async _createFresh(
    storage: HarnessStorage,
    init: {
      resourceId: string;
      threadId: string;
      ownsThread: boolean;
      sessionId?: string;
      parentSessionId?: string;
      origin: 'top-level' | 'subagent-tool';
      modeId?: string;
      modelId?: string;
      subagentDepth?: number;
    },
  ): Promise<Session> {
    const sessionId = init.sessionId ?? `sess-${randomUUID()}`;
    const now = Date.now();

    const modeId = init.modeId ?? this._defaultModeId;
    if (modeId === undefined) {
      throw new HarnessConfigError(
        'session()',
        'cannot create a session without a modeId — config has no modes and no override was supplied',
      );
    }
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('session().modeId', `unknown mode "${modeId}"`);
    }

    // First-write inserts the row, then we acquire the lease against it.
    // Lease + version both start at the values set here.
    const record: SessionRecord = {
      id: sessionId,
      resourceId: init.resourceId,
      threadId: init.threadId,
      parentSessionId: init.parentSessionId,
      origin: init.origin,
      ownsThread: init.ownsThread,
      subagentDepth: init.subagentDepth ?? 0,
      modeId,
      modelId: init.modelId ?? '',
      subagentModelOverrides: {},
      permissionRules: emptyPermissionRules(),
      sessionGrants: emptySessionGrants(),
      tokenUsage: zeroTokenUsage(),
      pendingQueue: [],
      state: {},
      createdAt: now,
      lastActivityAt: now,
      version: 0,
      ownerId: this.ownerId,
      leaseExpiresAt: now + this._leaseTtlMs,
    };

    let saved;
    try {
      saved = await storage.saveSession(record, { ownerId: this.ownerId, ifVersion: 0 });
    } catch (err) {
      // A version conflict on first insert means another writer beat us to
      // this id (only realistic for deterministic ids passed by the caller).
      if (err instanceof HarnessStorageVersionConflictError) {
        throw new HarnessSessionLockedError(sessionId, 'unknown', 0);
      }
      throw new HarnessStorageError(sessionId, 'flush', err);
    }
    record.version = saved.version;

    // Acquire the lease atomically so renews/CAS use a known TTL.
    const lease = await this._acquireLease(storage, sessionId);
    record.ownerId = this.ownerId;
    record.leaseExpiresAt = lease.expiresAt;
    record.version = lease.version;

    return this._publish(storage, record);
  }

  private async _hydrate(storage: HarnessStorage, stored: SessionRecord): Promise<Session> {
    const lease = await this._acquireLease(storage, stored.id);
    const record: SessionRecord = {
      ...stored,
      ownerId: this.ownerId,
      leaseExpiresAt: lease.expiresAt,
      version: lease.version,
    };
    return this._publish(storage, record);
  }

  private _publish(storage: HarnessStorage, record: SessionRecord): Session {
    // Workspace provider validation (§2.7). If the stored record carries a
    // workspace state blob, the configured provider must match. Mismatch is
    // a hard error — refuse to hand the record to the wrong implementation.
    // Non-resumable providers can never restore from stored state; flag the
    // session as "lost" so the first getWorkspace() call surfaces the error.
    let workspaceLost = false;
    if (record.workspace?.providerId && this._workspaceKind === 'per-session') {
      const configured = this._workspaceRegistry.providerId;
      if (configured && configured !== record.workspace.providerId) {
        throw new HarnessWorkspaceProviderMismatchError(record.id, configured, record.workspace.providerId);
      }
      if (!this._workspaceRegistry.resumable) {
        // Provider can't resume — first getWorkspace() throws HarnessWorkspaceLostError.
        workspaceLost = true;
      }
    }

    const session = new Session({
      harness: this,
      storage,
      ownerId: this.ownerId,
      record,
      leaseExpiresAt: record.leaseExpiresAt ?? Date.now() + this._leaseTtlMs,
    });
    if (workspaceLost) session._markWorkspaceLost();
    this._liveSessions.set(record.id, session);

    // Bridge the session's events onto the harness-level emitter so a single
    // harness.subscribe() sees every session's turn activity. Forwarded
    // events keep their original id/timestamp/sessionId.
    const bridge = session.subscribe(event => this._emitter.forward(event));
    this._sessionEventBridges.set(record.id, bridge);

    // Surface session creation to harness-level subscribers AFTER the bridge
    // is wired. Stamps `sessionId` via the override so harness emitter
    // (no scope) can carry it.
    this._emitter.emit(
      {
        type: 'session_created',
        resourceId: record.resourceId,
        threadId: record.threadId,
        ...(record.parentSessionId !== undefined && { parentSessionId: record.parentSessionId }),
        modeId: record.modeId,
        modelId: record.modelId,
      },
      { sessionId: record.id },
    );

    // If the hydrated record has queued items waiting and no live
    // suspension blocking them, kick the drain. Items recovered this way
    // emit `queue_item_replayed` instead of `queue_item_started` because
    // the original `queue()` caller's resolver is gone.
    if ((record.pendingQueue?.length ?? 0) > 0 && record.pendingResume === undefined) {
      void session._kickQueueDrain();
    }

    return session;
  }

  private async _acquireLease(storage: HarnessStorage, sessionId: string) {
    try {
      return await storage.acquireSessionLease({
        sessionId,
        ownerId: this.ownerId,
        ttlMs: this._leaseTtlMs,
      });
    } catch (err) {
      if (err instanceof HarnessStorageLeaseConflictError) {
        throw new HarnessSessionLockedError(sessionId, err.heldBy, err.expiresAt);
      }
      if (err instanceof HarnessStorageSessionNotFoundError) {
        throw new HarnessSessionNotFoundError(sessionId);
      }
      throw new HarnessStorageError(sessionId, 'load', err);
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /**
   * Soft-close: flush, set closedAt, release lease, drop from live map.
   * Cascades through parentSessionId — every descendant is closed too.
   * Idempotent. See §5.5.
   */
  async closeSession(opts: { sessionId: string }): Promise<void> {
    const storage = this._requireStorage('closeSession()');
    const live = this._liveSessions.get(opts.sessionId);
    if (live) {
      await this._closeSession(live);
      return;
    }
    const stored = await storage.loadSession({ sessionId: opts.sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(opts.sessionId);
    if (stored.closedAt !== undefined) return; // already closed → idempotent.
    // Hydrate so we have the lease, then close.
    const session = await this._hydrate(storage, stored);
    await this._closeSession(session);
  }

  /**
   * @internal — used by `Session.close()` and `Harness.closeSession()`.
   */
  async _closeSession(session: Session): Promise<void> {
    if (session.isClosed) return;

    const storage = this._requireStorage('closeSession()');
    const now = Date.now();
    const record = session.getRecord();
    const closed: SessionRecord = {
      ...record,
      lastActivityAt: now,
      closedAt: now,
    };

    let saved;
    try {
      saved = await storage.saveSession(closed, {
        ownerId: this.ownerId,
        ifVersion: record.version,
      });
    } catch (err) {
      throw new HarnessStorageError(session.id, 'flush', err);
    }
    closed.version = saved.version;

    // Cascade: close every direct child, recursively. The cascade is
    // synchronous and durable per §5.5, so we walk before releasing the
    // parent's lease — a crash in the middle leaves a partially-closed
    // tree and the next deleteSession on the original target completes.
    const children = await storage.listSessions({
      resourceId: record.resourceId,
      includeClosed: false,
      parentSessionId: record.id,
    });
    for (const child of children) {
      await this.closeSession({ sessionId: child.id });
    }

    try {
      await storage.releaseSessionLease({
        sessionId: session.id,
        ownerId: this.ownerId,
      });
    } catch {
      // Release is best-effort — record is already closed and the lease
      // will TTL out either way.
    }

    // Release the session's workspace under the configured ownership model.
    // `shared` is owned by the harness; nothing to release here.
    try {
      if (this._workspaceKind === 'per-session') {
        await this._workspaceRegistry.releasePerSession({ sessionId: session.id });
      } else if (this._workspaceKind === 'per-resource') {
        await this._workspaceRegistry.releasePerResource({ resourceId: record.resourceId });
      }
    } catch {
      // Best-effort — registry surfaces errors via workspace_error events.
    }

    session._markClosed(closed);

    // Emit session_closed BEFORE we tear down the per-session bridge so
    // harness-level subscribers see the lifecycle event for this session.
    // The session's own emitter is still wired and will publish to the
    // bridge before the unsubscribe lands.
    session._emit({ type: 'session_closed', reason: 'requested' });

    const bridge = this._sessionEventBridges.get(session.id);
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(session.id);
    }
    this._liveSessions.delete(session.id);
  }

  /**
   * Read-only listing of session records for a resource. Closed records are
   * excluded unless `includeClosed: true`.
   */
  async listSessions(opts: SessionListOptions & { parentSessionId?: string }): Promise<SessionSummary[]> {
    const storage = this._requireStorage('listSessions()');
    return storage.listSessions({
      resourceId: opts.resourceId,
      includeClosed: opts.includeClosed,
      parentSessionId: opts.parentSessionId,
    });
  }

  /**
   * Inspect a single record by id. Returns `null` if no record exists; does
   * not throw on closed records (this is the inspection path). The active
   * resolver throws for closed; this method returns them when requested.
   */
  async loadSession(opts: SessionLoadByIdOptions): Promise<SessionRecord | null> {
    const storage = this._requireStorage('loadSession()');
    const stored = await storage.loadSession({ sessionId: opts.sessionId });
    if (!stored) return null;
    if (stored.closedAt !== undefined && !opts.includeClosed) return null;
    return stored;
  }

  /**
   * Drain in-flight work and release every held lease. After `shutdown`,
   * `session()` rejects. Idempotent.
   */
  async shutdown(_opts?: ShutdownOptions): Promise<void> {
    if (this._shutdown) return;
    this._shutdown = true;

    let storage: HarnessStorage;
    try {
      storage = this._requireStorage('shutdown()');
    } catch {
      // No storage bound — nothing to release. Idempotent.
      this._liveSessions.clear();
      return;
    }

    // Release every held lease. We keep the records active in storage —
    // shutdown is not a close.
    const sessions = Array.from(this._liveSessions.values());
    for (const session of sessions) {
      try {
        await storage.releaseSessionLease({
          sessionId: session.id,
          ownerId: this.ownerId,
        });
      } catch {
        // Best-effort: leases TTL out anyway.
      }

      // Surface eviction to harness-level subscribers BEFORE we tear down
      // the bridge so the event still propagates.
      session._emit({ type: 'session_evicted', reason: 'shutdown' });

      const bridge = this._sessionEventBridges.get(session.id);
      if (bridge) {
        bridge();
        this._sessionEventBridges.delete(session.id);
      }
    }
    this._liveSessions.clear();

    // Tear down every provisioned workspace (shared + per-resource + per-session).
    try {
      await this._workspaceRegistry.shutdown();
    } catch {
      // Best-effort: errors surface through the workspace_error event.
    }
  }

  // -------------------------------------------------------------------------
  // Thread API (sidebar surface). See HARNESS_V1_SPEC.md §4.4 + §5.2.
  //
  // Threads are the durable artifact (message log + title), distinct from
  // the runtime Session. Every operation is resource-scoped — cross-resource
  // existence is never leaked. `delete` cascades to the live session via
  // `_closeSession` so the lease is released and child sessions are torn
  // down before the thread + messages are removed.
  // -------------------------------------------------------------------------

  threads = {
    create: async (opts: ThreadCreateOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.create()');
      const now = new Date();
      const thread = await memory.saveThread({
        thread: {
          id: opts.threadId ?? this._mintThreadId(),
          resourceId: opts.resourceId,
          title: opts.title,
          createdAt: now,
          updatedAt: now,
          metadata: opts.metadata as Record<string, unknown> | undefined,
        },
      });
      const record = toThreadRecord(thread);
      this._emitter.emit({
        type: 'thread_created',
        threadId: record.id,
        resourceId: record.resourceId,
        title: record.title,
      });
      return record;
    },

    list: async (opts: ThreadListOptions): Promise<ThreadListResult> => {
      const memory = await this._requireMemoryStorage('threads.list()');
      const out = await memory.listThreads({
        perPage: opts.perPage ?? 100,
        page: opts.page ?? 0,
        orderBy: opts.orderBy,
        filter: {
          resourceId: opts.resourceId,
          metadata: opts.metadata as Record<string, unknown> | undefined,
        },
      });
      return {
        threads: out.threads.map(toThreadRecord),
        total: out.total,
        perPage: out.perPage,
        page: out.page,
        hasMore: out.hasMore,
      };
    },

    get: async (opts: ThreadGetOptions): Promise<ThreadRecord | null> => {
      const memory = await this._requireMemoryStorage('threads.get()');
      const thread = await memory.getThreadById({ threadId: opts.threadId });
      if (!thread || thread.resourceId !== opts.resourceId) return null;
      return toThreadRecord(thread);
    },

    rename: async (opts: ThreadRenameOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.rename()');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }
      const previousTitle = existing.title;
      const merged: Record<string, unknown> = {
        ...((existing.metadata as Record<string, unknown> | undefined) ?? {}),
        ...((opts.metadata as Record<string, unknown> | undefined) ?? {}),
      };
      const updated = await memory.updateThread({
        id: opts.threadId,
        title: opts.title,
        metadata: merged,
      });
      const record = toThreadRecord(updated);
      this._emitter.emit({
        type: 'thread_renamed',
        threadId: record.id,
        resourceId: record.resourceId,
        title: opts.title,
        previousTitle,
      });
      return record;
    },

    clone: async (opts: ThreadCloneOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.clone()');
      const source = await memory.getThreadById({ threadId: opts.threadId });
      if (!source || source.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }
      const cloned = await memory.cloneThread({
        sourceThreadId: opts.threadId,
        newThreadId: opts.newThreadId,
        resourceId: opts.resourceId,
        title: opts.title,
        metadata: opts.metadata as Record<string, unknown> | undefined,
        options: opts.messageLimit !== undefined ? { messageLimit: opts.messageLimit } : undefined,
      });
      const record = toThreadRecord(cloned.thread);
      this._emitter.emit({
        type: 'thread_cloned',
        threadId: record.id,
        resourceId: record.resourceId,
        sourceThreadId: opts.threadId,
        title: record.title,
      });
      return record;
    },

    selectOrCreate: async (opts: ThreadSelectOrCreateOptions): Promise<ThreadRecord> => {
      if (opts.threadId) {
        const existing = await this.threads.get({
          resourceId: opts.resourceId,
          threadId: opts.threadId,
        });
        if (existing) return existing;
        // Fall through and create a fresh thread with the requested id so the
        // caller can pin a stable URL without breaking resource isolation.
        return this.threads.create({
          resourceId: opts.resourceId,
          threadId: opts.threadId,
          title: opts.title,
          metadata: opts.metadata,
        });
      }
      return this.threads.create({
        resourceId: opts.resourceId,
        title: opts.title,
        metadata: opts.metadata,
      });
    },

    delete: async (opts: ThreadDeleteOptions): Promise<void> => {
      const memory = await this._requireMemoryStorage('threads.delete()');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        // Idempotent: deleting a missing or foreign-owned thread is a no-op
        // from the caller's perspective. Cross-resource existence is never
        // leaked.
        return;
      }

      // Cascade: close the live session (if any) before deleting the thread
      // so the lease is released and any child sessions are torn down.
      const storage = this._requireStorage('threads.delete()');
      let cascaded = false;
      const stored = await storage.loadSessionByThread({
        threadId: opts.threadId,
        resourceId: opts.resourceId,
      });
      if (stored) {
        cascaded = true;
        const live = this._liveSessions.get(stored.id);
        const session = live ?? (await this._hydrate(storage, stored));
        await this._closeSession(session);
      }

      await memory.deleteThread({ threadId: opts.threadId });
      this._emitter.emit({
        type: 'thread_deleted',
        threadId: opts.threadId,
        resourceId: opts.resourceId,
        cascadedSessionClose: cascaded,
      });
    },
  };

  attachments = {
    upload: async (_opts: AttachmentUploadOptions): Promise<AttachmentRef> => {
      throw new Error('Harness.attachments.upload: not implemented');
    },
    delete: async (_opts: AttachmentDeleteOptions): Promise<void> => {
      throw new Error('Harness.attachments.delete: not implemented');
    },
  };

  // -------------------------------------------------------------------------
  // Internals.
  // -------------------------------------------------------------------------

  private _requireStorage(callsite: string): HarnessStorage {
    if (this._storageOverride) return this._storageOverride;
    if (this._mastra) {
      const composite = this._mastra.getStorage();
      // Domain access goes through getStore() everywhere else in the codebase
      // — keep this consistent so adapters that override the accessor (e.g.
      // to add caching or lazy init) plug in transparently. Synchronously
      // available because all current adapters resolve domains eagerly, but
      // we still resolve via the accessor rather than poking `.stores.harness`
      // directly.
      const harness = composite?.stores?.harness;
      if (harness) return harness;
    }
    throw new HarnessConfigError(
      'sessions.storage',
      `required for ${callsite} — pass storage in HarnessConfig.storage, HarnessConfig.sessions.storage, or via the Mastra instance backing this harness`,
    );
  }

  /**
   * Thread CRUD is owned by Mastra's memory storage domain, not by the
   * harness storage domain. We resolve it lazily through the bound Mastra
   * instance via `getStore('memory')` — the harness never persists threads
   * itself.
   */
  private async _requireMemoryStorage(callsite: string) {
    if (!this._mastra) {
      throw new HarnessConfigError(
        'mastra',
        `required for ${callsite} — thread CRUD needs a Mastra instance bound to this harness so we can access the memory storage domain`,
      );
    }
    const composite = this._mastra.getStorage();
    if (!composite) {
      throw new HarnessConfigError(
        'storage',
        `required for ${callsite} — the bound Mastra instance has no storage configured`,
      );
    }
    const memory = await composite.getStore('memory');
    if (!memory) {
      throw new HarnessConfigError(
        'storage.memory',
        `required for ${callsite} — the bound Mastra storage has no memory domain registered`,
      );
    }
    return memory;
  }

  /**
   * @internal — Session-facing soft variant of `_requireMemoryStorage`. Returns
   * `null` when memory storage is not configured instead of throwing, so
   * read-only consumers (e.g. `Session.listMessages`) can gracefully return an
   * empty history for ad-hoc threads without crashing.
   */
  async _internalTryGetMemoryStorage() {
    if (!this._mastra) return null;
    const composite = this._mastra.getStorage();
    if (!composite) return null;
    const memory = await composite.getStore('memory');
    return memory ?? null;
  }

  private _mintThreadId(): string {
    return `thread-${randomUUID()}`;
  }

  /** @internal — exposed for inspection in tests. */
  _internalLiveSessionCount(): number {
    return this._liveSessions.size;
  }

  /** @internal — accessor for `Session.queue()` admission caps. */
  get _internalMaxQueueDepth(): number {
    return this._maxQueueDepth;
  }

  /** @internal — goal-loop defaults, consumed by `Session.setGoal()` (§4.7). */
  get _internalGoalDefaults(): Readonly<{ defaultJudgeModel?: string; defaultMaxTurns: number }> {
    return this._goalDefaults;
  }
}

function toThreadRecord(thread: {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}): ThreadRecord {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: thread.metadata,
  };
}

function emptyPermissionRules(): PermissionRules {
  return { categories: {}, tools: {} };
}

function emptySessionGrants(): SessionGrants {
  return { categories: [], tools: [] };
}

function zeroTokenUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}
