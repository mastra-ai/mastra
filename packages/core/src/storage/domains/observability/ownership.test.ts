import {
  buildCreateSpanRecord as internalBuildCreateSpanRecord,
  EntityType as internalEntityType,
  listTracesArgsSchema as internalListTracesArgsSchema,
} from '@internal/observability/storage';
import { describe, expect, it } from 'vitest';

import {
  buildCreateSpanRecord as coreBuildCreateSpanRecord,
  EntityType as storageEntityType,
  listTracesArgsSchema as coreListTracesArgsSchema,
} from '../..';
import { EntityType as observabilityEntityType } from '../../../observability';

describe('observability storage ownership', () => {
  it('shares runtime constants between public core facades and the internal owner', () => {
    expect(observabilityEntityType).toBe(storageEntityType);
    expect(storageEntityType).toBe(internalEntityType);
  });

  it('keeps public tracing schemas and record builders as internal-owner facades', () => {
    expect(coreListTracesArgsSchema).toBe(internalListTracesArgsSchema);
    expect(coreBuildCreateSpanRecord).toBe(internalBuildCreateSpanRecord);
  });
});
