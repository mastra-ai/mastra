import type { AgentControllerEvent } from './types';

/**
 * A value as `JSON.stringify` writes it. Anything carrying `toJSON` is replaced
 * by what that returns, which covers both a `Date` and a `SerializableError`.
 * What JSON cannot carry becomes `never`, so an event that grows such a field
 * breaks its consumers here rather than reaching them as `{}` at runtime.
 */
type Jsonify<T> = T extends { toJSON(): infer R }
  ? Jsonify<R>
  : T extends Map<unknown, unknown> | Set<unknown> | bigint | ((...args: never[]) => unknown)
    ? never
    : T extends readonly (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

/** An {@link AgentControllerEvent} as it arrives on a client, after JSON. */
export type AgentControllerWireEvent = Jsonify<AgentControllerEvent>;
