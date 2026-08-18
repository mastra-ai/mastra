import type { AgentControllerEvent } from './types';

/**
 * A value as it survives the trip to a client: `JSON.stringify` turns `Date`s
 * into ISO strings and drops `Map`s and `Error`s to `{}`, so the stream handler
 * flattens those two before serializing.
 */
type Jsonify<T> = T extends Date
  ? string
  : T extends Error
    ? { name: string; message: string }
    : T extends Map<unknown, infer V>
      ? Record<string, Jsonify<V>>
      : T extends readonly (infer U)[]
        ? Jsonify<U>[]
        : T extends object
          ? { [K in keyof T]: Jsonify<T[K]> }
          : T;

/** An {@link AgentControllerEvent} as it arrives on a client, after JSON. */
export type AgentControllerWireEvent = Jsonify<AgentControllerEvent>;
