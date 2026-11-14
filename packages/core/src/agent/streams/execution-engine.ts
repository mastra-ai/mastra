import type { AgentStreamsConfig } from './types';

export type ExecutionEngine = 'durable' | 'evented' | false;
export type ExecutionEngineDefaults = Omit<AgentStreamsConfig, 'pubsub' | 'cache'>;
type DurableOption = boolean | AgentStreamsConfig | undefined;

/** Policy only: selecting an engine does not grant native execution capability. */
export class ExecutionEnginePolicy {
  #configured: DurableOption;
  #effective: DurableOption;
  #frozen = false;
  #registered = false;
  #wrapperOwned = false;
  #inherited = false;

  constructor(configured: DurableOption) {
    this.#configured = typeof configured === 'object' ? { ...configured } : configured;
    this.#effective = this.#configured;
  }

  get durable(): DurableOption {
    return typeof this.#effective === 'object' ? { ...this.#effective } : this.#effective;
  }

  get engine(): ExecutionEngine {
    return typeof this.#effective === 'object' ? (this.#effective.executionEngine ?? false) : false;
  }

  get inherited(): boolean {
    return this.#inherited;
  }

  freeze(): void {
    this.#frozen = true;
  }

  /** Returns the diagnostic kind when registration would change a fixed selection. */
  register(defaults: ExecutionEngineDefaults = {}): 'locked' | 'wrapper-owned' | undefined {
    if (this.#wrapperOwned) return defaults.executionEngine ? 'wrapper-owned' : undefined;
    const explicit = typeof this.#configured === 'object' ? this.#configured : {};
    let candidate: DurableOption = this.#configured;
    if (candidate !== false && Object.keys(defaults).length) {
      candidate = { ...explicit };
      for (const key of Object.keys(defaults) as (keyof ExecutionEngineDefaults)[]) {
        if (explicit[key] === undefined) Object.assign(candidate, { [key]: defaults[key] });
      }
    }
    const engine = typeof candidate === 'object' ? (candidate.executionEngine ?? false) : false;
    const conflict = this.#frozen && engine !== this.engine;
    if (!this.#registered) {
      this.#effective = conflict
        ? { ...(typeof candidate === 'object' ? candidate : {}), executionEngine: this.engine }
        : candidate;
      this.#inherited = !conflict && !!engine && explicit.executionEngine === undefined;
      this.#registered = true;
    }
    this.freeze();
    return conflict ? 'locked' : undefined;
  }

  ownByWrapper(): void {
    this.#wrapperOwned = true;
    this.#effective = { executionEngine: false };
    this.#inherited = false;
    this.freeze();
  }
}

export const CONTEXT_INSPECTION_MAX_DEPTH = 20;
export const CONTEXT_INSPECTION_MAX_NODES = 1000;

/** Best-effort diagnostics, not serialization or validation. Unknown values do not warn. */
export function hasNonJsonContextValue(value: unknown): boolean {
  const active = new WeakSet<object>();
  const completed = new WeakSet<object>();
  let nodes = 0;
  const inspect = (current: unknown, depth: number): boolean => {
    if (depth > CONTEXT_INSPECTION_MAX_DEPTH || ++nodes > CONTEXT_INSPECTION_MAX_NODES) return false;
    if (typeof current === 'function' || typeof current === 'symbol' || typeof current === 'bigint') return true;
    if (current === null || typeof current !== 'object') return false;
    if (active.has(current)) return true;
    if (completed.has(current)) return false;
    try {
      const prototype = Object.getPrototypeOf(current);
      if (!Array.isArray(current) && prototype !== Object.prototype && prototype !== null) return true;
      active.add(current);
      for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(current))) {
        if (descriptor.enumerable && 'value' in descriptor && inspect(descriptor.value, depth + 1)) return true;
      }
      completed.add(current);
      return false;
    } catch {
      return false;
    } finally {
      active.delete(current);
    }
  };
  return inspect(value, 0);
}
