import { createHash, randomUUID } from 'node:crypto';

import type { MastraMemory } from '../../memory';
import { toStandardSchema } from '../../schema';
import type { StandardSchemaWithJSON } from '../../schema';
import type { MastraCompositeStore } from '../../storage';
import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import type { DynamicArgument } from '../../types';
import { Workspace } from '../../workspace';
import { EventEmitter, sessionCreatedPayload } from './events';
import type { HarnessEventListener, HarnessEventUnsubscribe } from './events';
import type { HarnessConfig } from './harness.types';
import type { HarnessMode } from './mode';
import { Session } from './session';
import type { CloneSessionOptions } from './session.types';

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
  #state: TState;
  readonly #stateSchema?: StandardSchemaWithJSON<TState>;
  #stateUpdateQueue: Promise<void> = Promise.resolve();
  #workspace?: Workspace;
  readonly #workspaceFn?: Extract<DynamicArgument<Workspace | undefined>, (...args: any[]) => any>;

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
    this.#stateSchema = config.stateSchema ? toStandardSchema(config.stateSchema) : undefined;
    this.#state = {
      ...this.#getSchemaDefaults(),
      ...config.initialState,
    } as TState;

    if (config.workspace instanceof Workspace) {
      this.#workspace = config.workspace;
    } else if (typeof config.workspace === 'function') {
      this.#workspaceFn = config.workspace;
    } else if (config.workspace) {
      this.#workspace = new Workspace(config.workspace);
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

  getState(): Readonly<TState> {
    return Object.freeze({ ...(this.#state as Record<string, unknown>) }) as Readonly<TState>;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const run = this.#stateUpdateQueue.then(() => this.#applyStateUpdates(updates));
    this.#stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async updateState<TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }>,
  ): Promise<TResult> {
    const run = this.#stateUpdateQueue.then(async () => {
      const update = await updater(this.getState());
      if (update.updates && Object.keys(update.updates).length > 0) {
        await this.#applyStateUpdates(update.updates);
      }
      for (const event of update.events ?? []) {
        this.#events.emit(event);
      }
      return update.result;
    });

    this.#stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  getWorkspace(): Workspace | undefined {
    return this.#workspace;
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

  async #applyStateUpdates(updates: Partial<TState>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...(this.#state as Record<string, unknown>), ...(updates as Record<string, unknown>) };

    if (this.#stateSchema) {
      const result = await this.#stateSchema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map((issue: { message?: string }) => issue.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      this.#state = result.value as TState;
    } else {
      this.#state = newState as TState;
    }

    this.#events.emit({
      type: 'state_changed',
      state: this.#state as Record<string, unknown>,
      changedKeys,
    });
  }

  #getSchemaDefaults(): Partial<TState> {
    if (!this.#stateSchema) return {};

    const defaults: Record<string, unknown> = {};

    try {
      const jsonSchema = this.#stateSchema['~standard'].jsonSchema.output({ target: 'draft-07' }) as {
        properties?: Record<string, { default?: unknown }>;
      };
      for (const [key, prop] of Object.entries(jsonSchema.properties ?? {})) {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        }
      }
    } catch {
      // Schema doesn't support JSON Schema extraction.
    }

    return defaults as Partial<TState>;
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
      state: this.#state,
      stateSchema: this.#stateSchema,
      getState: () => this.getState(),
      setState: updates => this.setState(updates),
      updateState: updater => this.updateState(updater),
      workspace: this.#workspace,
      workspaceFn: this.#workspaceFn,
      setWorkspace: workspace => {
        this.#workspace = workspace;
      },
    });
  }

  #sessionIdFor(resourceId: string, threadId: string): string {
    const hash = createHash('sha256').update(`${resourceId}\0${threadId}`).digest('hex').slice(0, 32);
    return `sess-${hash}`;
  }
}
