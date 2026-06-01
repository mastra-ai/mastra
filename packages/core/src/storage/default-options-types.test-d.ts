import { describe, expectTypeOf, it } from 'vitest';
import type { RequireToolApprovalFn } from '../tools';
import type { StorageDefaultOptions } from './types';

/**
 * Stored agent default options must be serializable. `requireToolApproval` can be a function at
 * runtime (a per-call approval policy), but a function cannot be persisted, so the stored shape is
 * intentionally narrowed to `boolean`. This test guards against accidentally re-widening the field
 * to the runtime union — doing so previously broke `@mastra/server`'s build, which consumes
 * `StorageDefaultOptions` as a serializable shape.
 */
describe('StorageDefaultOptions serialization constraints', () => {
  it('keeps requireToolApproval boolean-only (no function policies in stored options)', () => {
    expectTypeOf<StorageDefaultOptions['requireToolApproval']>().toEqualTypeOf<boolean | undefined>();
  });

  it('is not assignable from a function-valued requireToolApproval policy', () => {
    expectTypeOf<RequireToolApprovalFn>().not.toExtend<StorageDefaultOptions['requireToolApproval']>();
  });
});
