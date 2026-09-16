import type { MemoryStorage } from '@mastra/core/storage';
import { expectTypeOf, test } from 'vitest';

import type { ObservationalMemoryConfig } from '../src/processors/observational-memory/types';

declare const storage: MemoryStorage;

test('archive and reflection configuration are mutually exclusive', () => {
  const archiveOnly: ObservationalMemoryConfig = {
    storage,
    observation: {
      archive: {
        afterTokens: 40_000,
        keepTokens: 8_000,
        maxCatalogTokens: 2_000,
      },
    },
  };
  const reflectionOnly: ObservationalMemoryConfig = {
    storage,
    reflection: { observationTokens: 40_000 },
  };

  expectTypeOf(archiveOnly).toExtend<ObservationalMemoryConfig>();
  expectTypeOf(reflectionOnly).toExtend<ObservationalMemoryConfig>();

  // @ts-expect-error Archive mode cannot be combined with explicit reflection configuration.
  const invalid: ObservationalMemoryConfig = {
    storage,
    observation: { archive: {} },
    reflection: { observationTokens: 40_000 },
  };
  void invalid;
});
