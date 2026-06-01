import { describe, expect, it } from 'vitest';
import { coreFeatures } from './index';

describe('coreFeatures defaults', () => {
  it('does NOT enable observability-delta-polling by default', () => {
    // Regression: delta polling has a known concurrency hole (cursorId > $after
    // skips late-committing rows from a non-transactional bigserial). The fix is
    // tracked in stores/pg/src/storage/domains/observability/v-next/polling.ts;
    // until it ships, the flag must remain opt-in to avoid silent data loss.
    expect(coreFeatures.has('observability-delta-polling')).toBe(false);
  });
});
