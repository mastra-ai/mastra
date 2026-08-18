import { describe, expectTypeOf, it } from 'vitest';
import type { AgentControllerWireEvent, Jsonify } from './wire';

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

describe('AgentControllerWireEvent', () => {
  it('carries every controller event field through JSON', () => {
    expectTypeOf<HasNeverLeaf<AgentControllerWireEvent>>().toEqualTypeOf<false>();
  });

  it('would flag a field JSON drops or empties', () => {
    expectTypeOf<HasNeverLeaf<Jsonify<{ tools: Map<string, string> }>>>().toEqualTypeOf<true>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ items: Set<string>[] }>>>().toEqualTypeOf<true>();
    expectTypeOf<HasNeverLeaf<Jsonify<{ tools: Record<string, { name: string }> }>>>().toEqualTypeOf<false>();
  });

  it('follows toJSON for dates and errors', () => {
    expectTypeOf<WireEventOf<'thread_created'>['thread']['createdAt']>().toEqualTypeOf<string>();
    expectTypeOf<WireEventOf<'workspace_error'>['error']>().toMatchTypeOf<{ name: string; message: string }>();
  });
});
