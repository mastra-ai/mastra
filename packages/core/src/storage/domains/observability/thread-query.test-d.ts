import { expectTypeOf, test } from 'vitest';
import { ObservabilityStorage } from './base';
import type { QueryThreadsResult, TrustedThreadQueryPlan } from './trace-query';

// Published adapters implement only the legacy signature. Upgrading core must not
// make those adapters unassignable to the base storage type.
class LegacyThreadAdapter extends ObservabilityStorage {
  override async queryThreads(_plan: TrustedThreadQueryPlan): Promise<QueryThreadsResult> {
    return { threads: [], page: { next: null } };
  }
}

test('accepts an identity-only adapter with newer core types', () => {
  expectTypeOf<LegacyThreadAdapter>().toExtend<ObservabilityStorage>();
});
