import type { AgentControllerEvent } from './types';

/**
 * A value as `JSON.stringify` writes it: anything carrying `toJSON` becomes
 * what that returns (a `Date`, a `SerializableError`), and what JSON cannot
 * carry becomes `never`. `wire.test-d.ts` fails if a controller event holds one.
 */
export type Jsonify<T> = T extends { toJSON(): infer R }
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
