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
import type { HarnessConfig } from './config';
import {
  HarnessConfigError,
  HarnessModelNotFoundError,
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
import type { HarnessMode, ToolCategory } from './shared';
import type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  AvailableModel,
  CustomModelCatalogProvider,
  ModelAuthChecker,
  ModelAuthStatus,
  ModelInfo,
  ModelUseCountProvider,
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
  ThreadGetSettingOptions,
  ThreadGetSettingsOptions,
  ThreadListOptions,
  ThreadListResult,
  ThreadRecord,
  ThreadRenameOptions,
  ThreadSelectOrCreateOptions,
  ThreadSetSettingsOptions,
} from './types';
import { WorkspaceRegistry } from './workspace-registry';

const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_QUEUE_DEPTH = 100;
const DEFAULT_SUBAGENT_MAX_DEPTH = 1;
const DEFAULT_GOAL_MAX_TURNS = 50;
const DEFAULT_PERMISSION_POLICY: PermissionPolicy = 'ask';

type IntervalHandler = NonNullable<HarnessConfig['intervals']>[number];

export class Harness<TState = unknown> {
  readonly id: string;
  readonly ownerId: string;

  private _mastra?: Mastra;
  private readonly _storageOverride?: HarnessStorage;
  private readonly _defaultResourceId: string;
  private readonly _resolveModel?: HarnessConfig<TState>['resolveModel'];
  private readonly _modesById: Map<string, HarnessMode<TState>>;
  private readonly _defaultModeId?: string;
  private readonly _liveSessions = new Map<string, Session>();
  private readonly _sessionResolutions = new Map<string, Promise<Session>>();
  private readonly _leaseTtlMs: number;
  private readonly _maxQueueDepth: number;
  private readonly _subagentTypes: ReadonlyMap<string, SubagentDefinition>;
  private readonly _subagentMaxDepth: number;
  private readonly _goalDefaults: { defaultJudgeModel?: string; defaultMaxTurns: number };
  private readonly _defaultPermissionPolicy: PermissionPolicy;
  private readonly _toolCategoryResolver?: (toolName: string) => ToolCategory | null;
  private readonly _modelCatalog: ReadonlyMap<string, ModelInfo>;
  private readonly _modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;
  private readonly _modelAuthChecker?: ModelAuthChecker;
  private readonly _modelUseCountProvider?: ModelUseCountProvider;
  private readonly _customModelCatalogProvider?: CustomModelCatalogProvider;
  private readonly _initialState?: TState | (() => TState | Promise<TState>);
  private readonly _configuredIntervals: readonly IntervalHandler[];
  private readonly _intervals = new Map<
    string,
    { timer: ReturnType<typeof setInterval>; abortController: AbortController; shutdown?: () => void | Promise<void> }
  >();
  private readonly _emitter = new EventEmitter();
  private readonly _sessionEventBridges = new Map<string, HarnessEventUnsubscribe>();

  readonly _workspaceRegistry: WorkspaceRegistry;
  readonly _workspaceKind?: 'shared' | 'per-resource' | 'per-session';

  private _shutdown = false;

  constructor(config: HarnessConfig<TState>) {
    this.ownerId = `harness-${randomUUID()}`;
    this.id = config.id ?? this.ownerId;
    this._defaultResourceId = config.resourceId ?? this.id;
    this._leaseTtlMs = config.sessions?.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
    this._storageOverride = config.sessions?.storage;
    this._maxQueueDepth = config.sessions?.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH;
    this._initialState = config.initialState;
    this._configuredIntervals = config.intervals ?? [];
    this._resolveModel = config.resolveModel;

    if (this._leaseTtlMs < 1) {
      throw new HarnessConfigError('sessions.leaseTtlMs', 'must be a positive integer');
    }
    if (this._maxQueueDepth < 1) {
      throw new HarnessConfigError('sessions.maxQueueDepth', 'must be a positive integer');
    }

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

    const goalsCfg = config.goals;
    if (goalsCfg?.defaultMaxTurns !== undefined && goalsCfg.defaultMaxTurns < 1) {
      throw new HarnessConfigError('goals.defaultMaxTurns', 'must be a positive integer');
    }
    this._goalDefaults = {
      ...(goalsCfg?.defaultJudgeModel !== undefined ? { defaultJudgeModel: goalsCfg.defaultJudgeModel } : {}),
      defaultMaxTurns: goalsCfg?.defaultMaxTurns ?? DEFAULT_GOAL_MAX_TURNS,
    };

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
    if (config.toolCategoryResolver) {
      this._toolCategoryResolver = config.toolCategoryResolver;
    } else if (config.toolCategories) {
      const map = config.toolCategories;
      this._toolCategoryResolver = (name: string) => map[name] ?? null;
    }

    const catalog = new Map<string, ModelInfo>();
    if (config.models) {
      if (!Array.isArray(config.models)) {
        throw new HarnessConfigError('models', 'must be an array of ModelInfo');
      }
      for (const entry of config.models) {
        if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
          throw new HarnessConfigError('models', 'every entry must have a non-empty string `id`');
        }
        if (typeof entry.providerId !== 'string' || entry.providerId.length === 0) {
          throw new HarnessConfigError('models', `entry "${entry.id}" must have a non-empty string \`providerId\``);
        }
        if (catalog.has(entry.id)) {
          throw new HarnessConfigError('models', `duplicate model id "${entry.id}"`);
        }
        catalog.set(entry.id, entry);
      }
    }
    this._modelCatalog = catalog;
    this._modelAuthStatusResolver = config.modelAuthStatusResolver;
    this._modelAuthChecker = config.modelAuthChecker;
    this._modelUseCountProvider = config.modelUseCountProvider;
    this._customModelCatalogProvider = config.customModelCatalogProvider;

    this._workspaceKind = config.workspace?.kind;
    this._workspaceRegistry = new WorkspaceRegistry({
      config: config.workspace,
      emitter: this._emitter,
    });
    if (config.workspace?.kind === 'shared' && config.workspace.eager) {
      void this._workspaceRegistry.acquireShared().catch(() => undefined);
    }
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

    this._modesById = new Map();
    for (const mode of config.modes ?? []) {
      if (this._modesById.has(mode.id)) {
        throw new HarnessConfigError('modes', `duplicate mode id "${mode.id}"`);
      }
      if (mode.tools && mode.additionalTools) {
        throw new HarnessConfigError(
          `modes[${mode.id}]`,
          'cannot set both "tools" and "additionalTools" - choose replace OR augment',
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
        throw new HarnessConfigError('defaultModeId', `references unknown mode "${config.defaultModeId}"`);
      }
      this._defaultModeId = config.defaultModeId;
    } else if (this._modesById.size > 0) {
      throw new HarnessConfigError('defaultModeId', 'must be set when "modes" is non-empty');
    }

    if (config.mastra) {
      this._bindMastra(config.mastra);
    } else if (config.agents !== undefined || config.storage !== undefined) {
      const internal = new Mastra({
        agents: config.agents,
        storage: config.storage ?? new InMemoryStore(),
      });
      this._bindMastra(internal);
    }
  }

  get mastra(): Mastra {
    if (!this._mastra) {
      throw new HarnessConfigError(
        'mastra',
        'harness is not yet bound to a Mastra - pass `mastra`/`agents`/`storage` at construction or register it on a parent Mastra',
      );
    }
    return this._mastra;
  }

  getMastra(): Mastra | undefined {
    return this._mastra;
  }

  __registerMastra(mastra: Mastra): void {
    if (this._mastra && this._mastra !== mastra) {
      throw new HarnessConfigError('mastra', 'harness is already bound to a different Mastra instance');
    }
    if (this._mastra === mastra) return;
    this._bindMastra(mastra);
  }

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
          `references unknown agent "${mode.agentId}" - Mastra has no such agent registered`,
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
          `references unknown agent "${def.agentId}" - Mastra has no such agent registered`,
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

  async init(): Promise<void> {
    if (this._shutdown) {
      throw new Error('Harness is shut down');
    }
    if (this._workspaceKind === 'shared') {
      await this._workspaceRegistry.acquireShared();
    }
    for (const interval of this._configuredIntervals) {
      this.onInterval(interval);
    }
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this._emitter.subscribe(listener);
  }

  onInterval(handler: IntervalHandler): HarnessEventUnsubscribe {
    if (this._shutdown) {
      throw new Error('Harness is shut down');
    }
    if (!handler || typeof handler.id !== 'string' || handler.id.length === 0) {
      throw new HarnessConfigError('intervals.id', 'must be a non-empty string');
    }
    if (!Number.isFinite(handler.everyMs) || handler.everyMs < 1) {
      throw new HarnessConfigError(`intervals["${handler.id}"].everyMs`, 'must be a positive number');
    }

    void this.stopInterval(handler.id);
    const abortController = new AbortController();
    const run = async () => {
      if (abortController.signal.aborted) return;
      try {
        await handler.handler({ harnessId: this.id, abortSignal: abortController.signal });
      } catch (error) {
        console.error(`[HarnessInterval:${handler.id}] failed:`, error);
      }
    };

    if (handler.immediate !== false) {
      void run();
    }

    const timer = setInterval(run, handler.everyMs);
    timer.unref?.();
    this._intervals.set(handler.id, { timer, abortController, shutdown: handler.shutdown });
    return () => {
      void this.stopInterval(handler.id);
    };
  }

  async stopInterval(id: string): Promise<void> {
    const entry = this._intervals.get(id);
    if (!entry) return;
    clearInterval(entry.timer);
    entry.abortController.abort();
    this._intervals.delete(id);
    await entry.shutdown?.();
  }

  async stopIntervals(): Promise<void> {
    const ids = Array.from(this._intervals.keys());
    for (const id of ids) {
      await this.stopInterval(id);
    }
  }

  _internalListenerCount(): number {
    return this._emitter.listenerCount;
  }

  async getWorkspace(): Promise<Workspace | undefined> {
    if (this._shutdown) {
      throw new Error('Harness is shut down');
    }
    if (this._workspaceKind !== 'shared') return undefined;
    return this._workspaceRegistry.acquireShared();
  }

  async destroyResourceWorkspace(opts: { resourceId: string }): Promise<void> {
    if (this._workspaceKind !== 'per-resource') {
      throw new HarnessConfigError(
        'workspace.kind',
        `destroyResourceWorkspace requires kind: "per-resource" (current: "${this._workspaceKind ?? 'unconfigured'}")`,
      );
    }
    await this._workspaceRegistry.destroyResourceWorkspace(opts);
  }

  _emit(event: Parameters<EventEmitter['emit']>[0], overrides?: Parameters<EventEmitter['emit']>[1]): HarnessEvent {
    return this._emitter.emit(event, overrides);
  }

  getAgentForMode(modeId: string): Agent {
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('modeId', `unknown mode "${modeId}"`);
    }
    return this.mastra.getAgent(mode.agentId as never) as Agent;
  }

  _getSubagentType(agentType: string): SubagentDefinition | undefined {
    return this._subagentTypes.get(agentType);
  }

  _listSubagentTypeIds(): string[] {
    return Array.from(this._subagentTypes.keys());
  }

  _getSubagentMaxDepth(): number {
    return this._subagentMaxDepth;
  }

  _getMode(modeId: string): HarnessMode<TState> {
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('modeId', `unknown mode "${modeId}"`);
    }
    return mode;
  }

  getDefaultResourceId(): string {
    return this._defaultResourceId;
  }

  async getKnownResourceIds(): Promise<string[]> {
    const memory = await this._requireMemoryStorage('getKnownResourceIds()');
    const out = await memory.listThreads({
      perPage: false,
      filter: {},
    });
    return [...new Set(out.threads.map(thread => thread.resourceId))].sort();
  }

  listModes(): HarnessMode<TState>[] {
    return Array.from(this._modesById.values());
  }

  getMode(modeId: string): HarnessMode<TState> | undefined {
    return this._modesById.get(modeId);
  }

  getToolCategory(opts: { toolName: string }): ToolCategory | null {
    if (!this._toolCategoryResolver) return null;
    return this._toolCategoryResolver(opts.toolName) ?? null;
  }

  _getDefaultPermissionPolicy(): PermissionPolicy {
    return this._defaultPermissionPolicy;
  }

  async listAvailableModels(): Promise<AvailableModel[]> {
    try {
      const { PROVIDER_REGISTRY } = await import('../../llm/model/provider-registry.js');
      if (!PROVIDER_REGISTRY) return [];

      const registry = PROVIDER_REGISTRY as Record<
        string,
        { models?: string[]; name?: string; apiKeyEnvVar?: string | string[] }
      >;
      const useCounts = this._modelUseCountProvider?.() ?? {};
      const modelsById = new Map<string, AvailableModel>();

      const upsertModel = (model: Omit<AvailableModel, 'useCount'>): void => {
        if (!model.id || !model.provider || !model.modelName) return;
        modelsById.set(model.id, {
          ...model,
          useCount: useCounts[model.id] ?? 0,
        });
      };

      for (const provider of Object.keys(registry)) {
        const providerConfig = registry[provider];
        const envVars = providerConfig?.apiKeyEnvVar;
        const apiKeyEnvVar = Array.isArray(envVars) ? envVars[0] : envVars;
        const hasApiKey = await this._hasProviderAuth(provider, apiKeyEnvVar);

        if (providerConfig?.models && Array.isArray(providerConfig.models)) {
          for (const modelName of providerConfig.models) {
            upsertModel({
              id: `${provider}/${modelName}`,
              provider,
              modelName,
              hasApiKey,
              apiKeyEnvVar: apiKeyEnvVar || undefined,
            });
          }
        }
      }

      for (const model of this._modelCatalog.values()) {
        const { provider, modelName } = splitModelId(model.id, model.providerId);
        upsertModel({
          id: model.id,
          provider,
          modelName,
          hasApiKey: await this._hasProviderAuth(provider),
          apiKeyEnvVar: await this._getProviderApiKeyEnvVar(provider),
        });
      }

      if (this._customModelCatalogProvider) {
        try {
          const customModels = await Promise.resolve(this._customModelCatalogProvider());
          for (const model of customModels) {
            upsertModel(model);
          }
        } catch (error) {
          console.warn('Failed to load custom available models:', error);
        }
      }

      return [...modelsById.values()];
    } catch (error) {
      console.warn('Failed to load available models:', error);
      return [];
    }
  }

  async session(opts: SessionResolveOptions): Promise<Session> {
    if (this._shutdown) {
      throw new Error('Harness is shut down');
    }
    const storage = this._requireStorage('session()');
    const key = this._sessionResolutionKey(opts);
    if (!key) return this._sessionUncoalesced(storage, opts);

    const existing = this._sessionResolutions.get(key);
    if (existing) return existing;

    const pending = this._sessionUncoalesced(storage, opts);
    this._sessionResolutions.set(key, pending);
    try {
      return await pending;
    } finally {
      this._sessionResolutions.delete(key);
    }
  }

  private async _sessionUncoalesced(storage: HarnessStorage, opts: SessionResolveOptions): Promise<Session> {
    if ('sessionId' in opts && opts.sessionId && !('threadId' in opts && opts.threadId)) {
      return this._resolveById(storage, opts.sessionId, opts.resourceId);
    }
    if ('threadId' in opts && opts.threadId !== undefined) {
      return this._resolveByThread(storage, opts);
    }
    if ('resourceId' in opts && opts.resourceId) {
      return this._resolveByResource(storage, opts);
    }
    throw new HarnessConfigError('session()', 'invalid resolver options');
  }

  private _sessionResolutionKey(opts: SessionResolveOptions): string | undefined {
    if ('sessionId' in opts && opts.sessionId) {
      return `session:${opts.sessionId}:${'resourceId' in opts ? (opts.resourceId ?? '') : ''}`;
    }
    if ('threadId' in opts && opts.threadId !== undefined) {
      if (typeof opts.threadId !== 'string') return undefined;
      return `thread:${opts.resourceId}:${opts.threadId}`;
    }
    if ('resourceId' in opts && opts.resourceId) {
      return `resource:${opts.resourceId}`;
    }
    return undefined;
  }

  private async _resolveById(storage: HarnessStorage, sessionId: string, resourceId?: string): Promise<Session> {
    const live = this._liveSessions.get(sessionId);
    if (live) {
      if (resourceId !== undefined && live.resourceId !== resourceId) {
        throw new HarnessSessionNotFoundError(sessionId);
      }
      return live;
    }

    const stored = await storage.loadSession({ sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(sessionId);
    if (resourceId !== undefined && stored.resourceId !== resourceId) {
      throw new HarnessSessionNotFoundError(sessionId);
    }
    if (stored.closedAt !== undefined) {
      throw new HarnessSessionClosedError(sessionId);
    }
    return this._hydrate(storage, stored);
  }

  private async _resolveByThread(
    storage: HarnessStorage,
    opts: Extract<SessionResolveOptions, { threadId: unknown }>,
  ): Promise<Session> {
    const wantsFreshThread = typeof opts.threadId !== 'string';
    const resourceId = opts.resourceId;

    if (wantsFreshThread) {
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
    for (const live of this._liveSessions.values()) {
      if (live.threadId === threadId && live.resourceId === resourceId) {
        if (opts.sessionId && live.id !== opts.sessionId) continue;
        return live;
      }
    }

    if (opts.sessionId) {
      const storedById = await storage.loadSession({ sessionId: opts.sessionId });
      if (storedById) {
        if (storedById.resourceId !== resourceId || storedById.threadId !== threadId) {
          throw new HarnessSessionNotFoundError(opts.sessionId);
        }
        if (storedById.closedAt !== undefined) {
          throw new HarnessSessionClosedError(opts.sessionId);
        }
        return this._hydrate(storage, storedById);
      }
    }

    const stored = await storage.loadSessionByThread({ threadId, resourceId });
    if (stored) {
      if (opts.sessionId && stored.id !== opts.sessionId) {
        await this._assertThreadIdAvailableForResource({ resourceId, threadId });
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

    await this._assertThreadIdAvailableForResource({ resourceId, threadId });
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
    const resourceId = opts.resourceId;
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
      const stored = await storage.loadSession({ sessionId: head.id });
      if (stored && stored.closedAt === undefined) {
        return this._hydrate(storage, stored);
      }
    }

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
    const initialState = await this._resolveInitialState();
    if (modeId === undefined) {
      throw new HarnessConfigError(
        'session()',
        'cannot create a session without a modeId - config has no modes and no override was supplied',
      );
    }
    if (!this._modesById.has(modeId)) {
      throw new HarnessConfigError('session().modeId', `unknown mode "${modeId}"`);
    }
    const modelId = await this._resolveInitialModelId({
      modelId: init.modelId,
      modeId,
      resourceId: init.resourceId,
    });

    const record: SessionRecord = {
      id: sessionId,
      resourceId: init.resourceId,
      threadId: init.threadId,
      parentSessionId: init.parentSessionId,
      origin: init.origin,
      ownsThread: init.ownsThread,
      subagentDepth: init.subagentDepth ?? 0,
      modeId,
      modelId,
      subagentModelOverrides: {},
      permissionRules: emptyPermissionRules(),
      sessionGrants: emptySessionGrants(),
      tokenUsage: zeroTokenUsage(),
      pendingQueue: [],
      state: initialState,
      createdAt: now,
      lastActivityAt: now,
      version: 0,
      ownerId: this.ownerId,
      leaseExpiresAt: now + this._leaseTtlMs,
    };

    let ownedThreadCreated = false;
    let saved;
    try {
      if (init.ownsThread) {
        ownedThreadCreated = await this._persistOwnedThread({
          resourceId: init.resourceId,
          threadId: init.threadId,
        });
      }
      saved = await storage.saveSession(record, { ownerId: this.ownerId, ifVersion: 0 });
    } catch (err) {
      if (ownedThreadCreated) {
        await this._deleteOwnedThreadBestEffort({ resourceId: init.resourceId, threadId: init.threadId });
      }
      if (err instanceof HarnessStorageVersionConflictError) {
        throw new HarnessSessionLockedError(sessionId, 'unknown', 0);
      }
      throw new HarnessStorageError(sessionId, 'flush', err);
    }
    record.version = saved.version;

    let lease;
    try {
      lease = await this._acquireLease(storage, sessionId);
    } catch (err) {
      const rolledBack = await this._deleteUnleasedNewSessionBestEffort(storage, sessionId, saved.version);
      if (ownedThreadCreated && rolledBack) {
        await this._deleteOwnedThreadBestEffort({ resourceId: init.resourceId, threadId: init.threadId });
      }
      throw err;
    }
    record.ownerId = this.ownerId;
    record.leaseExpiresAt = lease.expiresAt;
    record.version = lease.version;

    return this._publish(storage, record);
  }

  private async _hydrate(storage: HarnessStorage, stored: SessionRecord): Promise<Session> {
    const lease = await this._acquireLease(storage, stored.id);
    const latest = await storage.loadSession({ sessionId: stored.id });
    if (!latest) {
      await storage.releaseSessionLease({ sessionId: stored.id, ownerId: this.ownerId }).catch(() => undefined);
      throw new HarnessSessionNotFoundError(stored.id);
    }
    if (latest.closedAt !== undefined) {
      await storage.releaseSessionLease({ sessionId: stored.id, ownerId: this.ownerId }).catch(() => undefined);
      throw new HarnessSessionClosedError(stored.id);
    }
    const record: SessionRecord = {
      ...latest,
      ownerId: this.ownerId,
      leaseExpiresAt: lease.expiresAt,
      version: lease.version,
    };
    try {
      return this._publish(storage, record);
    } catch (err) {
      try {
        await storage.releaseSessionLease({
          sessionId: stored.id,
          ownerId: this.ownerId,
        });
      } catch {
        // Lease TTL covers failures; publishing failed before any live Session existed.
      }
      throw err;
    }
  }

  private _publish(storage: HarnessStorage, record: SessionRecord): Session {
    const existing = this._liveSessions.get(record.id);
    if (existing) return existing;

    let workspaceLost = false;
    if (record.workspace?.providerId && this._workspaceKind === 'per-session') {
      const configured = this._workspaceRegistry.providerId;
      if (configured && configured !== record.workspace.providerId) {
        throw new HarnessWorkspaceProviderMismatchError(record.id, configured, record.workspace.providerId);
      }
      if (!this._workspaceRegistry.resumable) {
        workspaceLost = true;
      }
    }

    const session = new Session({
      harness: this,
      storage,
      ownerId: this.ownerId,
      record,
      leaseExpiresAt: record.leaseExpiresAt ?? Date.now() + this._leaseTtlMs,
      leaseTtlMs: this._leaseTtlMs,
    });
    if (workspaceLost) session._markWorkspaceLost();
    this._liveSessions.set(record.id, session);

    const bridge = session.subscribe(event => this._emitter.forward(event));
    this._sessionEventBridges.set(record.id, bridge);
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

  async closeSession(opts: { sessionId: string }): Promise<void> {
    const storage = this._requireStorage('closeSession()');
    const live = this._liveSessions.get(opts.sessionId);
    if (live) {
      await this._closeSession(live);
      return;
    }
    const stored = await storage.loadSession({ sessionId: opts.sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(opts.sessionId);
    if (stored.closedAt !== undefined) return;
    const session = await this._hydrate(storage, stored);
    await this._closeSession(session);
  }

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

    let childCloseError: unknown;
    try {
      const children = await storage.listSessions({
        resourceId: record.resourceId,
        includeClosed: false,
        parentSessionId: record.id,
      });
      for (const child of children) {
        try {
          await this.closeSession({ sessionId: child.id });
        } catch (err) {
          childCloseError ??= err;
        }
      }
    } catch (err) {
      childCloseError ??= err;
    }

    try {
      await storage.releaseSessionLease({
        sessionId: session.id,
        ownerId: this.ownerId,
      });
    } catch {
      // The durable closed marker was already written; lease TTL covers failures.
    }

    try {
      if (this._workspaceKind === 'per-session') {
        await this._workspaceRegistry.releasePerSession({ sessionId: session.id });
      } else if (this._workspaceKind === 'per-resource') {
        await this._workspaceRegistry.releasePerResource({ resourceId: record.resourceId });
      }
    } catch {
      // Workspace registry errors are surfaced through workspace events.
    }

    session._markClosed(closed);
    session._emit({ type: 'session_closed', reason: 'requested' });

    const bridge = this._sessionEventBridges.get(session.id);
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(session.id);
    }
    this._liveSessions.delete(session.id);

    if (childCloseError) {
      throw new HarnessStorageError(session.id, 'flush', childCloseError);
    }
  }

  async listSessions(opts: SessionListOptions & { parentSessionId?: string }): Promise<SessionSummary[]> {
    const storage = this._requireStorage('listSessions()');
    return storage.listSessions({
      resourceId: opts.resourceId,
      includeClosed: opts.includeClosed,
      parentSessionId: opts.parentSessionId,
    });
  }

  async loadSession(opts: SessionLoadByIdOptions): Promise<SessionRecord | null> {
    const storage = this._requireStorage('loadSession()');
    const stored = await storage.loadSession({ sessionId: opts.sessionId });
    if (!stored) return null;
    if (stored.closedAt !== undefined && !opts.includeClosed) return null;
    return stored;
  }

  async shutdown(_opts?: ShutdownOptions): Promise<void> {
    if (this._shutdown) return;
    this._shutdown = true;

    await this.stopIntervals();

    let storage: HarnessStorage | undefined;
    try {
      storage = this._requireStorage('shutdown()');
    } catch {
      storage = undefined;
    }

    const sessions = Array.from(this._liveSessions.values());
    for (const session of sessions) {
      if (storage) {
        try {
          await storage.releaseSessionLease({
            sessionId: session.id,
            ownerId: this.ownerId,
          });
        } catch {
          // Leases expire naturally.
        }
      }

      await this._evictSession(session, 'shutdown');
    }

    try {
      await this._workspaceRegistry.shutdown();
    } catch {
      // Workspace registry errors are surfaced through workspace events.
    }
  }

  async _evictSession(session: Session, reason: 'idle' | 'pressure' | 'pinned_timeout' | 'shutdown' | 'lease_lost') {
    if (this._liveSessions.get(session.id) !== session) return;

    try {
      if (this._workspaceKind === 'per-session') {
        await this._workspaceRegistry.releasePerSession({ sessionId: session.id });
      } else if (this._workspaceKind === 'per-resource') {
        await this._workspaceRegistry.releasePerResource({ resourceId: session.resourceId });
      }
    } catch {
      // Workspace registry errors are surfaced through workspace events.
    }

    session._emit({ type: 'session_evicted', reason });
    session._markEvicted();

    const bridge = this._sessionEventBridges.get(session.id);
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(session.id);
    }
    this._liveSessions.delete(session.id);
  }

  threads = {
    create: async (opts: ThreadCreateOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.create()');
      const existing = opts.threadId ? await memory.getThreadById({ threadId: opts.threadId }) : null;
      if (existing) {
        throw new HarnessConfigError(
          'threadId',
          existing.resourceId === opts.resourceId
            ? 'thread id already exists for this resource'
            : 'thread id already exists for another resource',
        );
      }
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
        orderBy: opts.orderBy ? { field: opts.orderBy.column, direction: opts.orderBy.direction } : undefined,
        filter: {
          resourceId: opts.resourceId,
          metadata: opts.metadata as Record<string, unknown> | undefined,
        },
      });
      return {
        items: out.threads.map(toThreadRecord),
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
        return;
      }

      let cascaded = false;
      let storage: HarnessStorage | undefined;
      try {
        storage = this._requireStorage('threads.delete()');
      } catch {
        storage = undefined;
      }
      if (storage) {
        const sessions = await storage.listSessions({ resourceId: opts.resourceId, includeClosed: false });
        for (const summary of sessions) {
          if (summary.threadId !== opts.threadId) continue;
          cascaded = true;
          const live = this._liveSessions.get(summary.id);
          const stored = live ? undefined : await storage.loadSession({ sessionId: summary.id });
          if (!live && (!stored || stored.closedAt !== undefined)) continue;
          const session = live ?? (await this._hydrate(storage, stored!));
          await this._closeSession(session);
        }
      }

      await memory.deleteThread({ threadId: opts.threadId });
      this._emitter.emit({
        type: 'thread_deleted',
        threadId: opts.threadId,
        resourceId: opts.resourceId,
        cascadedSessionClose: cascaded,
      });
    },

    setSettings: async (opts: ThreadSetSettingsOptions): Promise<void> => {
      const memory = await this._requireMemoryStorage('threads.setSettings()');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }

      const before = (existing.metadata as Record<string, unknown> | undefined) ?? {};
      const next: Record<string, unknown> = { ...before };
      const effectivePatch: Record<string, unknown> = {};
      const removedKeys: string[] = [];

      for (const [key, value] of Object.entries(opts.patch)) {
        if (value === undefined) {
          if (key in next) {
            delete next[key];
            removedKeys.push(key);
          }
          continue;
        }
        if (!Object.is(before[key], value)) {
          next[key] = value;
          effectivePatch[key] = value;
        }
      }

      if (Object.keys(effectivePatch).length === 0 && removedKeys.length === 0) {
        return;
      }

      await memory.saveThread({
        thread: {
          ...existing,
          metadata: Object.keys(next).length > 0 ? next : undefined,
          updatedAt: new Date(),
        },
      });

      this._emitter.emit({
        type: 'thread_settings_changed',
        threadId: opts.threadId,
        resourceId: opts.resourceId,
        patch: effectivePatch,
        removedKeys,
      });
    },

    getSettings: async (opts: ThreadGetSettingsOptions): Promise<Readonly<Record<string, unknown>>> => {
      const memory = await this._requireMemoryStorage('threads.getSettings()');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }
      const metadata = (existing.metadata as Record<string, unknown> | undefined) ?? {};
      return Object.freeze({ ...metadata });
    },

    getSetting: async (opts: ThreadGetSettingOptions): Promise<unknown> => {
      const settings = await this.threads.getSettings({
        resourceId: opts.resourceId,
        threadId: opts.threadId,
      });
      return settings[opts.key];
    },
  };

  models = {
    list: async (): Promise<readonly ModelInfo[]> => Object.freeze(Array.from(this._modelCatalog.values())),

    get: async (modelId: string): Promise<ModelInfo | null> => this._modelCatalog.get(modelId) ?? null,

    getAuthStatus: async (modelId: string): Promise<ModelAuthStatus> => {
      if (!this._modelCatalog.has(modelId)) {
        throw new HarnessModelNotFoundError(modelId);
      }
      if (!this._modelAuthStatusResolver) return 'unknown';
      return await this._modelAuthStatusResolver(modelId);
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

  private _requireStorage(callsite: string): HarnessStorage {
    if (this._storageOverride) return this._storageOverride;
    if (this._mastra) {
      const composite = this._mastra.getStorage();
      const harness = composite?.stores?.harness;
      if (harness) return harness;
    }
    throw new HarnessConfigError(
      'sessions.storage',
      `required for ${callsite} - pass storage in HarnessConfig.storage, HarnessConfig.sessions.storage, or via the Mastra instance backing this harness`,
    );
  }

  private async _requireMemoryStorage(callsite: string) {
    if (!this._mastra) {
      throw new HarnessConfigError(
        'mastra',
        `required for ${callsite} - thread CRUD needs a Mastra instance bound to this harness so we can access the memory storage domain`,
      );
    }
    const composite = this._mastra.getStorage();
    if (!composite) {
      throw new HarnessConfigError(
        'storage',
        `required for ${callsite} - the bound Mastra instance has no storage configured`,
      );
    }
    const memory = await composite.getStore('memory');
    if (!memory) {
      throw new HarnessConfigError(
        'storage.memory',
        `required for ${callsite} - the bound Mastra storage has no memory domain registered`,
      );
    }
    return memory;
  }

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

  private async _persistOwnedThread(opts: { resourceId: string; threadId: string }): Promise<boolean> {
    const memory = await this._requireMemoryStorage('session()');
    const existing = await memory.getThreadById({ threadId: opts.threadId });
    if (existing && existing.resourceId !== opts.resourceId) {
      throw new HarnessConfigError('threadId', 'thread id already exists for another resource');
    }
    if (existing) return false;

    const now = new Date();
    await memory.saveThread({
      thread: {
        id: opts.threadId,
        resourceId: opts.resourceId,
        title: '',
        createdAt: now,
        updatedAt: now,
      },
    });
    this._emitter.emit({
      type: 'thread_created',
      threadId: opts.threadId,
      resourceId: opts.resourceId,
      title: '',
    });
    return true;
  }

  private async _assertThreadIdAvailableForResource(opts: { resourceId: string; threadId: string }): Promise<void> {
    const memory = await this._internalTryGetMemoryStorage();
    if (!memory) return;
    const existing = await memory.getThreadById({ threadId: opts.threadId });
    if (existing && existing.resourceId !== opts.resourceId) {
      throw new HarnessConfigError('threadId', 'thread id already exists for another resource');
    }
  }

  private async _deleteOwnedThreadBestEffort(opts: { resourceId: string; threadId: string }): Promise<void> {
    const memory = await this._internalTryGetMemoryStorage();
    if (!memory) return;
    const existing = await memory.getThreadById({ threadId: opts.threadId });
    if (!existing || existing.resourceId !== opts.resourceId) return;
    await memory.deleteThread({ threadId: opts.threadId }).catch(() => undefined);
  }

  private async _deleteUnleasedNewSessionBestEffort(
    storage: HarnessStorage,
    sessionId: string,
    version: number,
  ): Promise<boolean> {
    const stored = await storage.loadSession({ sessionId }).catch(() => null);
    if (!stored) return false;
    if (stored.version !== version) return false;
    if (stored.ownerId !== undefined || stored.leaseExpiresAt !== undefined) return false;
    try {
      await storage.deleteSession({ sessionId });
      return true;
    } catch {
      return false;
    }
  }

  private async _resolveInitialState(): Promise<unknown> {
    const value =
      typeof this._initialState === 'function'
        ? await (this._initialState as () => TState | Promise<TState>)()
        : this._initialState;
    if (value === undefined || value === null) return {};
    if (Array.isArray(value)) return [...value];
    if (typeof value === 'object') return { ...(value as Record<string, unknown>) };
    return value;
  }

  private async _resolveInitialModelId(opts: {
    modelId?: string;
    modeId: string;
    resourceId: string;
  }): Promise<string> {
    if (opts.modelId !== undefined) return opts.modelId;
    if (!this._resolveModel) return '';

    const mode = this._modesById.get(opts.modeId);
    const resolved = await this._resolveModel({
      modeId: opts.modeId,
      agentId: mode?.agentId,
      resourceId: opts.resourceId,
    });
    return resolved ?? '';
  }

  private async _hasProviderAuth(provider: string, apiKeyEnvVar?: string): Promise<boolean> {
    const customAuth = await this._modelAuthChecker?.(provider);
    if (customAuth !== undefined) return customAuth;
    const envVar = apiKeyEnvVar ?? (await this._getProviderApiKeyEnvVar(provider));
    return envVar ? !!process.env[envVar] : false;
  }

  private async _getProviderApiKeyEnvVar(provider: string): Promise<string | undefined> {
    try {
      const { PROVIDER_REGISTRY } = await import('../../llm/model/provider-registry.js');
      const registry = PROVIDER_REGISTRY as Record<string, { apiKeyEnvVar?: string | string[] }>;
      const envVars = registry[provider]?.apiKeyEnvVar;
      return Array.isArray(envVars) ? envVars[0] : envVars;
    } catch {
      return undefined;
    }
  }

  _internalLiveSessionCount(): number {
    return this._liveSessions.size;
  }

  get _internalMaxQueueDepth(): number {
    return this._maxQueueDepth;
  }

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

function splitModelId(modelId: string, providerId: string): { provider: string; modelName: string } {
  const prefix = `${providerId}/`;
  if (modelId.startsWith(prefix)) {
    return { provider: providerId, modelName: modelId.slice(prefix.length) };
  }
  const slash = modelId.indexOf('/');
  if (slash > 0) {
    return { provider: modelId.slice(0, slash), modelName: modelId.slice(slash + 1) };
  }
  return { provider: providerId, modelName: modelId };
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
