import type { AgentControllerDisplayState, AgentControllerEvent } from './types';

/** `Error` is structurally `{ name, message, stack? }`; the `stack` key tells an instance from a flattened {@link WireError}. */
type IsErrorInstance<T> = T extends Error ? ('stack' extends keyof T ? true : false) : false;

/** `T` as `JSON.stringify` writes it: `toJSON` followed, what JSON cannot carry turned to `never` (caught by `wire.test-d.ts`). */
export type Jsonify<T> = T extends { toJSON(): infer R }
  ? Jsonify<R>
  : T extends Map<unknown, unknown> | Set<unknown> | bigint | ((...args: never[]) => unknown)
    ? never
    : IsErrorInstance<T> extends true
      ? never
      : T extends readonly (infer U)[]
        ? Jsonify<U>[]
        : T extends object
          ? { [K in keyof T]: Jsonify<T[K]> }
          : T;

/** An `Error` as the server flattens it; JSON would drop a real `Error` to `{}`. */
export interface WireError {
  name: string;
  message: string;
}

/** `Object.fromEntries` stringifies keys, so the record is keyed by string whatever the Map was. */
type MapToRecord<T> = T extends Map<unknown, infer V> ? Record<string, V> : T;

export type WireDisplayState = {
  [K in keyof AgentControllerDisplayState]: MapToRecord<AgentControllerDisplayState[K]>;
};

type HoldsError<T> = [Extract<T, Error>] extends [never] ? false : true;

type ErrorToWireError<T> = HoldsError<T> extends true ? Exclude<T, Error> | WireError : T;

type WireShape<E> = E extends unknown
  ? {
      [K in keyof E]: K extends 'displayState' ? WireDisplayState : K extends 'error' ? ErrorToWireError<E[K]> : E[K];
    }
  : never;

type ErrorCarrying<E> = E extends { error?: infer T } ? (HoldsError<T> extends true ? E : never) : never;

/** The events whose `error` may hold an `Error`; the server flattens it to a {@link WireError}. */
export type ErrorCarryingAgentControllerEvent = ErrorCarrying<AgentControllerEvent>;

/** An event once the server has reshaped what JSON cannot carry (display-state Maps, `Error`s); `@mastra/server` types its transform against this. */
export type JsonReadyAgentControllerEvent = WireShape<AgentControllerEvent>;

/** An {@link AgentControllerEvent} as it arrives on a client, after JSON. */
export type AgentControllerWireEvent = Jsonify<JsonReadyAgentControllerEvent>;
