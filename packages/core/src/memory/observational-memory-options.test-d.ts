import { describe, expectTypeOf, it } from 'vitest';
import type { ObservationalMemoryObservationConfig, SerializedObservationalMemoryObservationConfig } from './types';

describe('observeAttachments option type', () => {
  it('accepts a MIME allowlist, matching the runtime default', () => {
    expectTypeOf<string[]>().toMatchTypeOf<NonNullable<ObservationalMemoryObservationConfig['observeAttachments']>>();
    expectTypeOf<'auto'>().toMatchTypeOf<NonNullable<ObservationalMemoryObservationConfig['observeAttachments']>>();
    expectTypeOf<boolean>().toMatchTypeOf<NonNullable<ObservationalMemoryObservationConfig['observeAttachments']>>();
  });

  it('accepts a MIME allowlist on the serialized observation config', () => {
    expectTypeOf<string[]>().toMatchTypeOf<
      NonNullable<SerializedObservationalMemoryObservationConfig['observeAttachments']>
    >();
  });
});
