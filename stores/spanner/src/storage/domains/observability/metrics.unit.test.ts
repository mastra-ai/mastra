import type { Database } from '@google-cloud/spanner';
import { describe, expect, it, vi } from 'vitest';

import { getMetricBreakdown } from './metrics';

describe('Spanner metric ID list filters', () => {
  it('binds each ID list as one parameter so 1,000 IDs stay under the 950-parameter limit', async () => {
    const run = vi.fn().mockResolvedValue([[]]);
    const ids = (prefix: string) => Array.from({ length: 1000 }, (_, i) => `${prefix}-${i}`);

    await getMetricBreakdown({ run } as unknown as Database, {
      name: ['mastra_model_total_input_tokens'],
      groupBy: ['experimentId'],
      aggregation: 'sum',
      filters: { experimentIds: ids('exp') as [string, ...string[]], traceIds: ids('trace') as [string, ...string[]] },
    });

    const query = run.mock.calls[0]![0];
    expect(Object.keys(query.params).length).toBeLessThan(950);
    expect(query.sql).toContain('`experimentId` IN UNNEST(@');
    expect(query.sql).toContain('`traceId` IN UNNEST(@');
  });
});
