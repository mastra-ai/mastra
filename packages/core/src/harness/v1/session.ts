import type { HarnessMode } from './mode';
import type { SessionConfig } from './session.types';

export class Session {
  /** Stable identity. Frozen at construction. */
  readonly #id: string;
  readonly #resourceId: string;
  readonly #threadId: string;
  readonly #createdAt: Date;
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
