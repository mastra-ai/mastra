import { describe, expectTypeOf, it } from 'vitest';
import type {
  ModelFallbackPartData as ProcessorModelFallbackPartData,
  PendingModelFallback as ProcessorPendingModelFallback,
} from '../auth/account-rotation-processor.js';
import type { ModelFallbackPartData, PendingModelFallback } from '../model-fallback.js';
import type { PendingModelFallback as SchemaPendingModelFallback } from '../schema.js';

describe('deprecated fallback type exports', () => {
  it('keeps the moved fallback types on the processor and schema subpaths', () => {
    expectTypeOf<ProcessorModelFallbackPartData>().toEqualTypeOf<ModelFallbackPartData>();
    expectTypeOf<ProcessorPendingModelFallback>().toEqualTypeOf<PendingModelFallback>();
    expectTypeOf<SchemaPendingModelFallback>().toEqualTypeOf<PendingModelFallback>();
  });
});
