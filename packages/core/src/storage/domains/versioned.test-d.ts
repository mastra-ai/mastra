import { describe, expectTypeOf, it } from 'vitest';
import type { LegacyVersionedStorage } from './versioned.test';

describe('VersionedStorageDomain subclass compatibility', () => {
  it('allows the pre-label abstract contract to remain a concrete, constructible class', () => {
    expectTypeOf<typeof LegacyVersionedStorage>().toExtend<new () => LegacyVersionedStorage>();
  });
});
