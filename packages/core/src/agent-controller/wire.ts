import type { AgentControllerEvent } from './types';

/**
 * A value as `JSON.stringify` writes it. Anything carrying `toJSON` is replaced
 * by what that returns, which covers both a `Date` and a `SerializableError`.
 */
type Jsonify<T> = T extends { toJSON(): infer R }
  ? Jsonify<R>
  : T extends readonly (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

/** An {@link AgentControllerEvent} as it arrives on a client, after JSON. */
export type AgentControllerWireEvent = Jsonify<AgentControllerEvent>;
