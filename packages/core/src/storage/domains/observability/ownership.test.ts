import { describe, expect, it } from 'vitest';

import { EntityType as storageEntityType } from '../..';
import { EntityType as observabilityEntityType } from '../../../observability';

describe('observability storage ownership', () => {
  it('shares EntityType runtime identity between public core facades', () => {
    expect(observabilityEntityType).toBe(storageEntityType);
  });
});
