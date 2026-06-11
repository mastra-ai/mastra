import { createHash, randomUUID } from 'node:crypto';

import type { Agent } from '../../agent';
import { MastraGateway } from '../../llm';
import type { MastraModelGatewayInterface } from '../../llm';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory';
import type { MastraCompositeStore } from '../../storage';
import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import { augmentWithInit } from '../../storage/storageWithInit';
import type { DynamicArgument } from '../../types';
import { Workspace } from '../../workspace';
import { EventEmitter, sessionCreatedPayload } from './events';
import type { HarnessEventListener, HarnessEventUnsubscribe } from './events';
import type { HarnessConfig } from './harness.types';
import type { HarnessMode } from './mode';
import type {
  PermissionPolicy,
  PermissionRequestedCallback,
  PermissionRules,
  SessionGrant,
  ToolCategoryResolver,
} from './permissions.types';
import { Session } from './session';
import type { AgentResolver, CloneSessionOptions } from './session.types';
import type { SubagentRegistryConfig } from './subagents.types';

type SessionByIdOptions = {
  sessionId: string;
  resourceId?: string;
};

type SessionByThreadOptions = {
  sessionId?: undefined;
  threadId: string;
  resourceId: string;
  modeId?: string;
  modelId?: string;
};

type SessionOptions = SessionByIdOptions | SessionByThreadOptions;

function isHarnessStorage(storage: HarnessStorage | MastraCompositeStore): storage is HarnessStorage {
  return typeof (storage as { loadSession?: unknown }).loadSession === 'function';
}

export class Harness<MODES extends HarnessMode[], TState = {}> {
  readonly #id: string;
  readonly #ownerId: string;
  readonly #defaultMode: string;
  readonly #modesById = new Map<string, MODES[number]>();
  readonly #storage?: HarnessStorage;
  readonly #compositeStorage?: MastraCompositeStore;
  readonly #mastra?: Mastra;
  readonly #memory: MastraMemory | DynamicArgument<MastraMemory>;
  readonly #events: EventEmitter;
  readonly #stateSchema?: HarnessConfig<MODES, TState>['stateSchema'];
  readonly #initialState?: Partial<TState>;
  readonly #workspace?: DynamicArgument<Workspace | undefined>;
  readonly #agent: Agent;
  readonly #subagents?: SubagentRegistryConfig;
  readonly #runtimeCompatibilityGeneration?: string | null;
  readonly #defaultPermissionPolicy: PermissionPolicy;
  readonly #permissionRules?: PermissionRules;
  readonly #sessionGrants: readonly SessionGrant[];
  readonly #onPermissionRequested?: PermissionRequestedCallback;
  readonly #toolCategoryResolver?: ToolCategoryResolver;
  readonly #gateways: Array<MastraModelGatewayInterface>;

  constructor(config: HarnessConfig<MODES, TState>) {
    if (!config.modes.length) {
      throw new Error('The harness needs modes to operate.');
    }

    this.#id = config.id;
    this.#ownerId = config.ownerId ?? randomUUID();
    this.#defaultMode = config.defaultModeId ?? config.modes[0]!.id;
    this.#mastra = config.mastra;
    if (config.storage) {
      if (isHarnessStorage(config.storage)) {
        this.#storage = config.storage;
      } else {
        this.#compositeStorage = augmentWithInit(config.storage);
      }
    } else {
      this.#compositeStorage = config.mastra?.getStorage();
    }
    this.#memory = config.memory;
    this.#events = new EventEmitter();
    if (config.runtimeCompatibilityGeneration !== undefined && config.runtimeCompatibilityGeneration.length === 0) {
      throw new Error('Harness runtimeCompatibilityGeneration must be a non-empty string when configured');
    }
    this.#runtimeCompatibilityGeneration = config.runtimeCompatibilityGeneration ?? null;
    this.#stateSchema = config.stateSchema;
    this.#initialState = config.initialState;

    if (config.workspace instanceof Workspace || typeof config.workspace === 'function') {
      this.#workspace = config.workspace;
    } else if (config.workspace) {
      this.#workspace = new Workspace(config.workspace);
    }

    this.#agent = this.#mastra ? this.#mastra.getAgentById(config.agent) : (config.agent as Agent);

    if (config.subagents) {
      const entries = Object.entries(config.subagents.types ?? {});
      for (const [typeId, def] of entries) {
        if (!def?.agentId) {
          throw new Error(`Subagent "${typeId}" must declare an "agentId"`);
        }
        // When using an inline `agents` map, validate eagerly. When backed by
        // a Mastra instance, the agent registry may grow over time; defer the
        // check to resolution time.
        // if (!config.mastra && !this.#agents[def.agentId]) {
        //   throw new Error(`Subagent "${typeId}" references unknown agent "${def.agentId}"`);
        // }
      }
      const maxDepth = config.sessions?.maxSubagentDepth ?? config.subagents.maxDepth ?? 1;
      if (!Number.isInteger(maxDepth) || maxDepth < 0) {
        throw new Error('Harness sessions.maxSubagentDepth must be a non-negative integer');
      }
      this.#subagents = { ...config.subagents, maxDepth };
    }
    this.#gateways = config.gateways
      ? config.gateways.length
        ? config.gateways
        : [new MastraGateway()]
      : [new MastraGateway()];

    this.#defaultPermissionPolicy = config.defaultPermissionPolicy ?? 'ask';
    this.#permissionRules = config.permissionRules;
    this.#sessionGrants = config.sessionGrants ?? [];
    this.#onPermissionRequested = config.onPermissionRequested;
    if (config.toolCategoryResolver) {
      this.#toolCategoryResolver = config.toolCategoryResolver;
    } else if (config.toolCategories) {
      const categories = config.toolCategories;
      this.#toolCategoryResolver = (toolName: string) => categories[toolName] ?? null;
    }

    const modes = config.modes ?? [];
    for (const mode of modes) {
      if (this.#modesById.has(mode.id)) {
        throw new Error(`Duplicate mode id "${mode.id}" found when creating the Harness`);
      }

      if (mode.tools && mode.additionalTools) {
        throw new Error(`Mode "${mode.id} cannot set both "tools" and "additionalTools" - choose replace OR augment`);
      }
      this.#modesById.set(mode.id, mode);
    }
  }

  get id(): string {
    return this.#id;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this.#events.subscribe(listener);
  }

  emit(event: Parameters<EventEmitter['emit']>[0]): ReturnType<EventEmitter['emit']> {
    return this.#events.emit(event);
  }

  async init(): Promise<void> {}

  async shutdown(): Promise<void> {}

  listModes(): HarnessMode[] {
    return [...this.#modesById.values()];
  }

  /**
   * Look up a single mode by id. Returns `undefined` if no mode with that id
   * is registered. For the throwing variant used during request resolution,
   * see the internal `_getMode` helper.
   */
  getMode(modeId: string): HarnessMode | undefined {
    return this.#modesById.get(modeId);
  }

  async listSessions(): Promise<SessionRecord[]> {
    const storage = await this.#requireStorage();
    return storage.listSessions();
  }

  async session(opts: SessionOptions): Promise<Session<TState>> {
    const storage = await this.#requireStorage();

    if ('threadId' in opts) {
      return this.#sessionByThread(storage, opts);
    }

    const record = await this.#loadSessionRecord(storage, opts.sessionId, opts.resourceId);
    return this.#sessionFromRecord(record, storage);
  }

  async cloneSession(session: Session<TState>, opts: CloneSessionOptions = {}): Promise<Session<TState>> {
    const storage = await this.#requireStorage();
    const source = await this.#loadSessionRecord(storage, session.id, session.resourceId);
    const modeId = opts.modeId ?? source.modeId;
    const mode = this.#modesById.get(modeId);
    if (!mode) {
      throw new Error(`Harness session "${source.id}" cannot clone into unknown mode "${modeId}"`);
    }

    const clone = await session.clone({
      ...opts,
      resourceId: opts.resourceId ?? source.resourceId,
      mode,
      modelId: opts.modelId ?? source.modelId,
    });
    const parentSessionId = opts.parentSessionId ?? source.id;
    const cloneModeId = opts.modeId ?? source.modeId;
    const cloneModelId = opts.modelId ?? source.modelId;
    const record: SessionRecord = {
      id: clone.id,
      ownerId: this.#ownerId,
      threadId: clone.threadId,
      resourceId: clone.resourceId,
      parentSessionId,
      origin: opts.origin ?? source.origin,
      source: {
        type: opts.origin ?? source.origin,
        parentSessionId,
      },
      subagentDepth: (source.subagentDepth ?? 0) + 1,
      runtimeCompatibilityGeneration: this.#runtimeCompatibilityGeneration,
      modeId: cloneModeId,
      modelId: cloneModelId,
      title: opts.title ?? source.title,
      metadata: opts.metadata ?? source.metadata,
      state: clone.getState() as Record<string, unknown>,
      pending: [],
      createdAt: clone.createdAt,
      lastActivityAt: clone.lastActivityAt,
    };

    await storage.saveSession(record);
    this.#events.emit({ type: 'session_created', ...sessionCreatedPayload(record) });
    return this.#sessionFromRecord(record, storage);
  }

  async #sessionByThread(storage: HarnessStorage, opts: SessionByThreadOptions): Promise<Session<TState>> {
    const id = this.#sessionIdFor(opts.resourceId, opts.threadId);
    const existing = await storage.loadSession(id);
    if (existing) {
      return this.#sessionFromRecord(existing, storage);
    }

    const modeId = opts.modeId ?? this.#defaultMode;
    const mode = this.#modesById.get(modeId);
    if (!mode) {
      throw new Error(`Harness session for thread "${opts.threadId}" cannot use unknown mode "${modeId}"`);
    }

    const record: SessionRecord = {
      id,
      ownerId: this.#ownerId,
      threadId: opts.threadId,
      resourceId: opts.resourceId,
      origin: 'top-level',
      modeId,
      modelId: opts.modelId ?? mode.defaultModelId,
      source: { type: 'top-level' },
      subagentDepth: 0,
      runtimeCompatibilityGeneration: this.#runtimeCompatibilityGeneration,
      ...(this.#initialState ? { state: this.#initialState as Record<string, unknown> } : {}),
      pending: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    await storage.saveSession(record);
    this.#events.emit({ type: 'session_created', ...sessionCreatedPayload(record) });
    return this.#sessionFromRecord(record, storage);
  }

  async #loadSessionRecord(storage: HarnessStorage, sessionId: string, resourceId?: string): Promise<SessionRecord> {
    const record = await storage.loadSession(sessionId);
    if (!record) {
      throw new Error(`Harness session "${sessionId}" was not found`);
    }
    if (resourceId && record.resourceId !== resourceId) {
      throw new Error(`Harness session "${sessionId}" does not belong to resource "${resourceId}"`);
    }
    return record;
  }

  async #requireStorage(): Promise<HarnessStorage> {
    if (this.#storage) {
      return this.#storage;
    }

    if (!this.#compositeStorage) {
      throw new Error('Harness session storage is not configured');
    }

    const storage = await this.#compositeStorage.getStore('harness');
    if (!storage) {
      throw new Error('Harness session storage is not configured');
    }
    return storage;
  }

  #sessionFromRecord(record: SessionRecord, storage: HarnessStorage): Session<TState> {
    const mode = record.modeId ? this.#modesById.get(record.modeId) : this.#modesById.values().next().value;
    if (!mode) {
      throw new Error(`Harness session "${record.id}" references unknown mode "${record.modeId}"`);
    }

    return new Session<TState>({
      id: record.id,
      ownerId: record.ownerId,
      threadId: record.threadId,
      resourceId: record.resourceId,
      mode: mode,
      model: record.modelId,
      createdAt: record.createdAt,
      lastActivityAt: record.lastActivityAt,
      agent: this.#agent,
      memory: this.#memory,
      storage,
      record,
      runtimeCompatibilityGeneration: this.#runtimeCompatibilityGeneration,
      events: this.#events.scoped({ sessionId: record.id }),
      stateSchema: this.#stateSchema,
      initialState: this.#initialState,
      workspace: this.#workspace,
      subagents: this.#subagents,
      agentResolver: this.#mastra as AgentResolver | undefined,
      modes: this.#modesById,
      gateways: this.#gateways,
      defaultPermissionPolicy: this.#defaultPermissionPolicy,
      permissionRules: this.#permissionRules,
      sessionGrants: this.#sessionGrants,
      onPermissionRequested: this.#onPermissionRequested,
      toolCategoryResolver: this.#toolCategoryResolver,
    });
  }

  #sessionIdFor(resourceId: string, threadId: string): string {
    const hash = createHash('sha256').update(`${resourceId}\0${threadId}`).digest('hex').slice(0, 32);
    return `sess-${hash}`;
  }
}
