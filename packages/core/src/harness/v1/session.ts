import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory, StorageThreadType } from '../../memory';
import type { HarnessMode } from './mode';
import type { CloneSessionOptions, SessionConfig } from './session.types';

export class Session {
  /** Stable identity. Frozen at construction. */
  readonly #id: string;
  readonly #resourceId: string;
  readonly #threadId: string;
  readonly #createdAt: Date;
  readonly #memory: MastraMemory;
  // readonly parentSessionId?: string;
  // readonly subagentDepth: number;
  // readonly createdAt: number;

  #modelId: string;
  #mode: HarnessMode;

  constructor(config: SessionConfig) {
    this.#id = config.id;
    this.#resourceId = config.resourceId;
    this.#threadId = config.threadId;
    this.#mode = config.mode;
    this.#modelId = config.model;
    this.#createdAt = config.createdAt;
    this.#memory = config.memory;
  }

  get id(): string {
    return this.#id;
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

  async clone(opts: CloneSessionOptions = {}): Promise<Session> {
    const result = await this.#memory.cloneThread({
      sourceThreadId: this.#threadId,
      newThreadId: opts.threadId,
      resourceId: opts.resourceId ?? this.#resourceId,
      title: opts.title,
      metadata: opts.metadata,
      options: opts.messageLimit ? { messageLimit: opts.messageLimit } : undefined,
    });

    return new Session({
      id: opts.sessionId ?? randomUUID(),
      threadId: result.thread.id,
      resourceId: result.thread.resourceId,
      mode: opts.mode ?? this.#mode,
      model: opts.modelId ?? this.#modelId,
      createdAt: result.thread.createdAt,
      memory: this.#memory,
    });
  }

  async getThread(): Promise<StorageThreadType | null> {
    return this.#memory.getThreadById({ threadId: this.#threadId });
  }

  async getMessages(): Promise<MastraDBMessage[]> {
    const result = await this.#memory.recall({ threadId: this.#threadId, resourceId: this.#resourceId });
    return result.messages;
  }

  async saveMessages(
    messages: MastraDBMessage[],
  ): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
    return this.#memory.saveMessages({ messages });
  }

  getModelId(): string {
    return this.#modelId;
  }

  setModelId(modelId: string) {
    this.#modelId = modelId;
  }

  getMode(): HarnessMode {
    return this.#mode;
  }

  setMode(mode: HarnessMode) {
    this.#mode = mode;
  }
}
