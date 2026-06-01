import { randomUUID } from 'node:crypto';

import { RequestContext } from '@internal/core/request-context';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory, StorageThreadType } from '../../memory';
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
  readonly #getState?: () => Readonly<TState>;
  readonly #setState?: (updates: Partial<TState>) => Promise<void>;
  readonly #updateState?: SessionConfig<TState>['updateState'];
  #workspace?: Workspace;
  readonly #workspaceFn?: Extract<DynamicArgument<Workspace | undefined>, (...args: any[]) => any>;
  readonly #setWorkspace?: (workspace: Workspace | undefined) => void;
  // readonly parentSessionId?: string;
  // readonly subagentDepth: number;

  #modelId: string;
  #subagentModelId: string | undefined;
  #mode: HarnessMode;

  constructor(config: SessionConfig<TState>) {
    this.#id = config.id;
    this.#ownerId = config.ownerId;
    this.#resourceId = config.resourceId;
    this.#threadId = config.threadId;
    this.#mode = config.mode;
    this.#modelId = config.model;
    this.#subagentModelId = config.subagentModelId;
    this.#createdAt = config.createdAt;
    this.#lastActivityAt = config.lastActivityAt;
    this.#memory = config.memory;
    this.#events = config.events;
    this.#getState = config.getState;
    this.#setState = config.setState;
    this.#updateState = config.updateState;
    this.#workspace = config.workspace;
    this.#workspaceFn = config.workspaceFn;
    this.#setWorkspace = config.setWorkspace;
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
      subagentModelId: opts.subagentModelId ?? this.#subagentModelId,
      createdAt: result.thread.createdAt,
      lastActivityAt: result.thread.updatedAt,
      memory: this.#memory,
      events: this.#events.scoped({ sessionId: cloneId }),
      getState: this.#getState,
      setState: this.#setState,
      updateState: this.#updateState,
      workspace: this.#workspace,
      workspaceFn: this.#workspaceFn,
      setWorkspace: this.#setWorkspace,
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

  getSubagentModelId(): string | undefined {
    return this.#subagentModelId;
  }

  setSubagentModelId(modelId: string | undefined) {
    this.#subagentModelId = modelId;
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

  async #buildRequestContext(requestContext?: RequestContext): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const harnessContext = {
      state: this.#getState?.(),
      getState: this.#getState,
      setState: this.#setState,
      updateState: this.#updateState,
      threadId: this.#threadId,
      resourceId: this.#resourceId,
      modeId: this.#mode.id,
      workspace: this.#workspace,
      getSubagentModelId: () => this.getSubagentModelId() ?? null,
    };

    requestContext.set('harness', harnessContext);

    if (this.#workspaceFn) {
      const resolved = await Promise.resolve(this.#workspaceFn({ requestContext }));
      harnessContext.workspace = resolved;
      this.#workspace = resolved;
      this.#setWorkspace?.(resolved);
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
