import { describe, expectTypeOf, it } from 'vitest';
import type { AgentMemoryOption } from '../agent/types';
import type {
  ObservationalMemoryObservationConfig,
  SerializedObservationalMemoryConfig,
  SerializedObservationalMemoryObservationConfig,
} from './types';

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

describe('retrieval.searchTimeoutMs', () => {
  it("is accepted in an agent call's memory options", () => {
    const memory: AgentMemoryOption = {
      thread: 'thread-1',
      options: { observationalMemory: { retrieval: { vector: true, searchTimeoutMs: 60_000 } } },
    };
    expectTypeOf(memory).toEqualTypeOf<AgentMemoryOption>();
  });

  it('is kept in a stored agent config', () => {
    const config: SerializedObservationalMemoryConfig = { retrieval: { vector: true, searchTimeoutMs: 60_000 } };
    expectTypeOf(config).toEqualTypeOf<SerializedObservationalMemoryConfig>();
  });
});
