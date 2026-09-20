import { describe, expect, it, vi } from 'vitest';

import type { DbClient } from '../../../client';
import { batchCreateScores } from './scores';

describe('score writes', () => {
  it('preserves millisecond-distinct timestamps when collapsing exact batch conflicts', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as DbClient;
    const firstTimestamp = new Date('2026-01-01T00:00:00.100Z');
    const secondTimestamp = new Date('2026-01-01T00:00:00.900Z');

    await batchCreateScores(client, 'public', {
      scores: [
        {
          scoreId: 'score-with-milliseconds',
          timestamp: firstTimestamp,
          scorerId: 'quality',
          score: 0.2,
        },
        {
          scoreId: 'score-with-milliseconds',
          timestamp: secondTimestamp,
          scorerId: 'quality',
          score: 0.8,
        },
      ],
    });

    expect(query).toHaveBeenCalledOnce();
    const values = query.mock.calls[0]![1] as unknown[];
    expect(values.filter(value => value instanceof Date)).toEqual([firstTimestamp, secondTimestamp]);
  });

  it('collapses equivalent timestamp strings to the last batch entry', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as DbClient;

    await batchCreateScores(client, 'public', {
      scores: [
        {
          scoreId: 'score-with-equivalent-timestamps',
          timestamp: '2026-01-01T00:00:00Z' as unknown as Date,
          scorerId: 'quality',
          score: 0.2,
        },
        {
          scoreId: 'score-with-equivalent-timestamps',
          timestamp: '2026-01-01T00:00:00.000Z' as unknown as Date,
          scorerId: 'quality',
          score: 0.8,
        },
      ],
    });

    expect(query).toHaveBeenCalledOnce();
    const values = query.mock.calls[0]![1] as unknown[];
    expect(values).toContain(0.8);
    expect(values).not.toContain(0.2);
  });
});
