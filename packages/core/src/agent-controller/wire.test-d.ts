import { describe, expectTypeOf, it } from 'vitest';
import type { ActiveToolState } from './types';
import type {
  AgentControllerWireEvent,
  ErrorCarryingAgentControllerEvent,
  JsonReadyAgentControllerEvent,
  Jsonify,
} from './wire';

type IsAny<T> = 0 extends 1 & T ? true : false;
type Shallower = [never, 0, 1, 2, 3, 4, 5, 6, 7];

/**
 * `true` when some leaf of `T` is `never`, i.e. a value JSON would have dropped
 * or emptied. Bounded in depth so recursive JSON value types terminate.
 */
type HasNeverLeaf<T, Depth extends number = 8> = [Depth] extends [never]
  ? false
  : IsAny<T> extends true
    ? false
    : [T] extends [never]
      ? true
      : T extends readonly (infer U)[]
        ? HasNeverLeaf<U, Shallower[Depth]>
        : T extends object
          ? true extends { [K in keyof T]-?: HasNeverLeaf<T[K], Shallower[Depth]> }[keyof T]
            ? true
            : false
          : false;

type WireEventOf<T extends AgentControllerWireEvent['type']> = Extract<AgentControllerWireEvent, { type: T }>;
type ReadyEventOf<T extends JsonReadyAgentControllerEvent['type']> = Extract<
  JsonReadyAgentControllerEvent,
  { type: T }
>;

describe('AgentControllerWireEvent', () => {
  it('carries every controller event field through JSON', () => {
    expectTypeOf<HasNeverLeaf<AgentControllerWireEvent>>().toEqualTypeOf<false>();
  });

  it('would flag a field JSON drops or empties', () => {
    expectTypeOf<HasNeverLeaf<Jsonify<{ tools: Map<string, string> }>>>().toEqualTypeOf<true>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ items: Set<string>[] }>>>().toEqualTypeOf<true>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ cause: Error }>>>().toEqualTypeOf<true>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ value: symbol }>>>().toEqualTypeOf<true>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ tools: Record<string, { name: string }> }>>>().toEqualTypeOf<false>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ error: { name: string; message: string } }>>>().toEqualTypeOf<false>();
  });

  it('reshapes the display state Maps and the errors under `error`, nothing else', () => {
    expectTypeOf<ReadyEventOf<'display_state_changed'>['displayState']['activeTools']>().toEqualTypeOf<
      Record<string, ActiveToolState>
    >();
    expectTypeOf<ReadyEventOf<'error'>['error']>().toEqualTypeOf<{ name: string; message: string }>();
    expectTypeOf<ReadyEventOf<'workspace_status_changed'>['error']>().toEqualTypeOf<
      { name: string; message: string } | undefined
    >();
    expectTypeOf<ReadyEventOf<'om_observation_failed'>['error']>().toEqualTypeOf<string>();
    expectTypeOf<ErrorCarryingAgentControllerEvent['type']>().toEqualTypeOf<
      'error' | 'workspace_error' | 'workspace_status_changed'
    >();
  });

  it('follows toJSON for dates', () => {
    expectTypeOf<WireEventOf<'thread_created'>['thread']['createdAt']>().toEqualTypeOf<string>();
    expectTypeOf<WireEventOf<'display_state_changed'>['displayState']['modifiedFiles']>().toEqualTypeOf<
      Record<string, { operations: string[]; firstModified: string }>
    >();
  });
});
