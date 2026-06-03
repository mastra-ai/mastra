import { createHash, randomUUID } from 'node:crypto';

import type { Agent } from '../../agent';
import type { MastraMemory } from '../../memory';
import type { MastraCompositeStore } from '../../storage';
import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import type { DynamicArgument } from '../../types';
import { Workspace } from '../../workspace';
import type { Skill } from '../../workspace/skills/types';
import { EventEmitter, sessionCreatedPayload } from './events';
import type { HarnessEventListener, HarnessEventUnsubscribe } from './events';
import type { HarnessConfig } from './harness.types';
import type { HarnessMode } from './mode';
import type { PermissionPolicy, ToolCategory, ToolCategoryResolver } from './permissions.types';
import { Session } from './session';
import type { CloneSessionOptions } from './session.types';
import type { ModelResolver, SubagentRegistryConfig } from './subagents.types';

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

export class Harness<MODES extends HarnessMode[], TState = {}> {
  readonly #ownerId: string;
  readonly #defaultMode: string;
  readonly #modesById = new Map<string, MODES[number]>();
  readonly #storage?: HarnessStorage;
  readonly #compositeStorage?: MastraCompositeStore;
  readonly #memory: MastraMemory | DynamicArgument<MastraMemory>;
  readonly #events: EventEmitter;
  readonly #stateSchema?: HarnessConfig<MODES, TState>['stateSchema'];
  readonly #initialState?: Partial<TState>;
  readonly #workspace?: DynamicArgument<Workspace | undefined>;
  readonly #agents: Record<string, Agent>;
  readonly #mastra?: HarnessConfig<MODES, TState>['mastra'];
  readonly #subagents?: SubagentRegistryConfig;
  readonly #resolveModel?: ModelResolver;
  readonly #skills: readonly Skill[];
  readonly #defaultPermissionPolicy: PermissionPolicy;
  readonly #toolCategoryResolver?: ToolCategoryResolver;

  constructor(config: HarnessConfig<MODES, TState>) {
    if (!config.modes.length) {
      throw new Error('The harness needs modes to operate.');
    }

    this.#ownerId = config.ownerId ?? randomUUID();
    this.#defaultMode = config.defaultModeId ?? config.modes[0]!.id;
    this.#storage = config.storage;
    this.#compositeStorage = config.mastra?.getStorage();
    this.#memory = config.memory;
    this.#events = new EventEmitter();
    this.#stateSchema = config.stateSchema;
    this.#initialState = config.initialState;

    if (config.workspace instanceof Workspace || typeof config.workspace === 'function') {
      this.#workspace = config.workspace;
    } else if (config.workspace) {
      this.#workspace = new Workspace(config.workspace);
    }

    this.#agents = { ...(config.agents ?? {}) };
    this.#mastra = config.mastra;

    if (config.subagents) {
      const entries = Object.entries(config.subagents.types ?? {});
      if (entries.length > 0 && !config.resolveModel) {
        throw new Error('Harness "subagents" requires a "resolveModel" function to instantiate subagent models');
      }
      for (const [typeId, def] of entries) {
        if (!def?.agentId) {
          throw new Error(`Subagent "${typeId}" must declare an "agentId"`);
        }
        // When using an inline `agents` map, validate eagerly. When backed by
        // a Mastra instance, the agent registry may grow over time; defer the
        // check to resolution time.
        if (!config.mastra && !this.#agents[def.agentId]) {
          throw new Error(`Subagent "${typeId}" references unknown agent "${def.agentId}"`);
        }
      }
      this.#subagents = config.subagents;
    }
    this.#resolveModel = config.resolveModel;

    const seenSkillNames = new Set<string>();
    for (const skill of config.skills ?? []) {
      if (seenSkillNames.has(skill.name)) {
        throw new Error(`Duplicate harness skill name "${skill.name}"`);
      }
      seenSkillNames.add(skill.name);
    }
    this.#skills = config.skills ? [...config.skills] : [];

    this.#defaultPermissionPolicy = config.defaultPermissionPolicy ?? 'ask';
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

  get ownerId(): string {
    return this.#ownerId;
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this.#events.subscribe(listener);
  }

  emit(event: Parameters<EventEmitter['emit']>[0]): ReturnType<EventEmitter['emit']> {
    return this.#events.emit(event);
  }

  getWorkspace(): Workspace | undefined {
    return typeof this.#workspace === 'function' ? undefined : this.#workspace;
  }

  /**
   * Returns the configured subagent registry, if any. Read-only.
   */
  getSubagents(): SubagentRegistryConfig | undefined {
    return this.#subagents;
  }

  /**
   * Returns the explicitly configured skills (read-only snapshot).
   */
  getSkills(): readonly Skill[] {
    return this.#skills;
  }

  /**
   * Returns the default permission policy. Defaults to `'ask'`.
   */
  getDefaultPermissionPolicy(): PermissionPolicy {
    return this.#defaultPermissionPolicy;
  }

  /**
   * Resolves a tool name to its category, if a resolver is configured.
   */
  resolveToolCategory(toolName: string): ToolCategory | null {
    return this.#toolCategoryResolver ? this.#toolCategoryResolver(toolName) : null;
  }

  /**
   * Resolves an agent by id from the inline `agents` map or the parent Mastra.
   * Throws when neither path knows about the id.
   */
  getAgentById(agentId: string): Agent {
    const inline = this.#agents[agentId];
    if (inline) return inline;
    if (this.#mastra) {
      return this.#mastra.getAgentById(agentId as never) as Agent;
    }
    throw new Error(`Agent "${agentId}" is not registered on this Harness`);
  }

  /**
   * Resolves a model id via the configured {@link ModelResolver}.
   * Throws when no resolver is configured.
   */
  async resolveModel(modelId: string) {
    if (!this.#resolveModel) {
      throw new Error('Harness was constructed without a "resolveModel" function');
    }
    return this.#resolveModel(modelId);
  }

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
    return this.#sessionFromRecord(record);
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
    const record: SessionRecord = {
      ...source,
      id: clone.id,
      ownerId: this.#ownerId,
      threadId: clone.threadId,
      resourceId: clone.resourceId,
      parentSessionId: opts.parentSessionId ?? source.id,
      origin: opts.origin ?? source.origin,
      modeId: opts.modeId ?? source.modeId,
      modelId: opts.modelId ?? source.modelId,
    };

    await storage.saveSession(record);
    this.#events.emit({ type: 'session_created', ...sessionCreatedPayload(record) });
    return this.#sessionFromRecord(record);
  }

  async #sessionByThread(storage: HarnessStorage, opts: SessionByThreadOptions): Promise<Session<TState>> {
    const id = this.#sessionIdFor(opts.resourceId, opts.threadId);
    const existing = await storage.loadSession(id);
    if (existing) {
      return this.#sessionFromRecord(existing);
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
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    await storage.saveSession(record);
    this.#events.emit({ type: 'session_created', ...sessionCreatedPayload(record) });
    return this.#sessionFromRecord(record);
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

    const storage = await this.#compositeStorage?.getStore('harness');
    if (!storage) {
      throw new Error('Harness session storage is not configured');
    }
    return storage;
  }

  #sessionFromRecord(record: SessionRecord): Session<TState> {
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
      memory: this.#memory,
      events: this.#events.scoped({ sessionId: record.id }),
      stateSchema: this.#stateSchema,
      initialState: this.#initialState,
      workspace: this.#workspace,
      skills: this.#skills,
      subagents: this.#subagents,
      resolveModel: this.#resolveModel,
      defaultPermissionPolicy: this.#defaultPermissionPolicy,
      toolCategoryResolver: this.#toolCategoryResolver,
    });
  }

  #sessionIdFor(resourceId: string, threadId: string): string {
    const hash = createHash('sha256').update(`${resourceId}\0${threadId}`).digest('hex').slice(0, 32);
    return `sess-${hash}`;
  }
}
