import { randomUUID } from 'node:crypto';

import { RequestContext } from '@internal/core/request-context';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory, StorageThreadType } from '../../memory';
import { toStandardSchema } from '../../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../../schema';
import type { DynamicArgument } from '../../types';
import type { Workspace } from '../../workspace';
import type { EventEmitter } from './events';
import type { HarnessMode } from './mode';
import type { CloneSessionOptions, SessionConfig } from './session.types';

export class Session<TState = {}> {
  /** Stable identity. Frozen at construction. */
  readonly #id: string;
  readonly #ownerId: string;
  readonly #resourceId: string;
  readonly #threadId: string;
  readonly #createdAt: Date;
  readonly #lastActivityAt: Date;
  readonly #memory: MastraMemory | DynamicArgument<MastraMemory>;
  readonly #events: EventEmitter;
  readonly #stateSchemaInput?: PublicSchema<TState>;
  readonly #stateSchema?: StandardSchemaWithJSON<TState>;
  #state: TState;
  #stateUpdateQueue: Promise<void> = Promise.resolve();
  readonly #workspace?: DynamicArgument<Workspace | undefined>;
  #resolvedWorkspace?: Workspace;
  #workspaceResolved = false;
  // readonly parentSessionId?: string;
  // readonly subagentDepth: number;

  #modelId: string;
  #mode: HarnessMode;

  constructor(config: SessionConfig<TState>) {
    this.#id = config.id;
    this.#ownerId = config.ownerId;
    this.#resourceId = config.resourceId;
    this.#threadId = config.threadId;
    this.#mode = config.mode;
    this.#modelId = config.model;
    this.#createdAt = config.createdAt;
    this.#lastActivityAt = config.lastActivityAt;
    this.#memory = config.memory;
    this.#events = config.events;
    this.#stateSchemaInput = config.stateSchema;
    this.#stateSchema = config.stateSchema ? toStandardSchema(config.stateSchema) : undefined;
    this.#state = {
      ...this.#getSchemaDefaults(),
      ...config.initialState,
    } as TState;
    this.#workspace = config.workspace;
  }

  get id(): string {
    return this.#id;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  get resourceId(): string {
    return this.#resourceId;
  }

  get threadId(): string {
    return this.#threadId;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  async clone(opts: CloneSessionOptions = {}): Promise<Session<TState>> {
    const result = await (
      await this.#resolveMemory()
    ).cloneThread({
      sourceThreadId: this.#threadId,
      newThreadId: opts.threadId,
      resourceId: opts.resourceId ?? this.#resourceId,
      title: opts.title,
      metadata: opts.metadata,
      options: opts.messageLimit !== undefined ? { messageLimit: opts.messageLimit } : undefined,
    });

    const cloneId = opts.sessionId ?? randomUUID();
    const clone = new Session<TState>({
      id: cloneId,
      ownerId: this.#ownerId,
      threadId: result.thread.id,
      resourceId: result.thread.resourceId,
      mode: opts.mode ?? this.#mode,
      model: opts.modelId ?? this.#modelId,
      createdAt: result.thread.createdAt,
      lastActivityAt: result.thread.updatedAt,
      memory: this.#memory,
      events: this.#events.scoped({ sessionId: cloneId }),
      stateSchema: this.#stateSchemaInput,
      initialState: this.getState() as Partial<TState>,
      workspace: this.#workspace,
    });

    this.#events.emit({
      type: 'thread_cloned',
      threadId: clone.threadId,
      resourceId: clone.resourceId,
      sourceThreadId: this.#threadId,
      title: opts.title,
    });

    return clone;
  }

  async getThread(): Promise<StorageThreadType | null> {
    return (await this.#resolveMemory()).getThreadById({ threadId: this.#threadId });
  }

  async getMessages(): Promise<MastraDBMessage[]> {
    const result = await (
      await this.#resolveMemory()
    ).recall({ threadId: this.#threadId, resourceId: this.#resourceId });
    return result.messages;
  }

  async saveMessages(
    messages: MastraDBMessage[],
  ): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
    return (await this.#resolveMemory()).saveMessages({ messages });
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

  getModelId(): string {
    return this.#modelId;
  }

  setModelId(modelId: string) {
    const previousModelId = this.#modelId;
    this.#modelId = modelId;
    if (modelId !== previousModelId) {
      this.#events.emit({ type: 'model_changed', modelId, previousModelId });
    }
  }

  getMode(): HarnessMode {
    return this.#mode;
  }

  setMode(mode: HarnessMode) {
    const previousModeId = this.#mode.id;
    this.#mode = mode;
    if (mode.id !== previousModeId) {
      this.#events.emit({ type: 'mode_changed', modeId: mode.id, previousModeId });
    }
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

  async #buildRequestContext(requestContext?: RequestContext): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const workspace = typeof this.#workspace === 'function' ? this.#resolvedWorkspace : this.#workspace;
    const harnessContext = {
      state: this.getState(),
      getState: () => this.getState(),
      setState: (updates: Partial<TState>) => this.setState(updates),
      updateState: <TResult>(
        updater: (
          state: Readonly<TState>,
        ) =>
          | { updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }
          | Promise<{ updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }>,
      ) => this.updateState(updater),
      threadId: this.#threadId,
      resourceId: this.#resourceId,
      modeId: this.#mode.id,
      workspace,
    };

    requestContext.set('harness', harnessContext);

    if (typeof this.#workspace === 'function' && !this.#workspaceResolved) {
      const resolved = await this.#workspace({ requestContext });
      this.#resolvedWorkspace = resolved;
      this.#workspaceResolved = true;
      harnessContext.workspace = resolved;
    }

    return requestContext;
  }

  async #resolveMemory(): Promise<MastraMemory> {
    const mem = this.#memory;
    if (!mem) {
      throw new Error('Memory is not configured on this Harness');
    }
    if (typeof mem !== 'function') {
      return mem;
    }
    const requestContext = await this.#buildRequestContext();
    const resolved = await mem({ requestContext });
    if (!resolved) {
      throw new Error('Dynamic memory factory returned empty value');
    }
    return resolved;
  }
}
