import { describe, expectTypeOf, it } from 'vitest';

import type { HarnessAdmissionEvidence, PendingInteraction } from './contracts';

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;
type QueueAdmissionPublicEvidence = Extract<HarnessAdmissionEvidence, { queuedItemId: string }>;

describe('Harness v1 canonical contract types', () => {
  it('PendingInteraction does not expose runtime recovery fields', () => {
    expectTypeOf<HasKey<PendingInteraction, 'runtimeDependencies'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<PendingInteraction, 'resumedAt'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<PendingInteraction, 'approvedTransitionModeId'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<PendingInteraction, 'modeTransitionAppliedAt'>>().toEqualTypeOf<false>();
  });

  it('HarnessAdmissionEvidence does not expose queue runtime dependencies', () => {
    expectTypeOf<HasKey<QueueAdmissionPublicEvidence, 'runtimeDependencies'>>().toEqualTypeOf<false>();
  });
});
