import { TABLE_SPANS } from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { StoreOperationsMySQL } from './index';

describe('StoreOperationsMySQL.pruneBatch', () => {
  it('rejects an unsafe batch limit before building the DELETE statement', async () => {
    const execute = vi.fn();
    const operations = new StoreOperationsMySQL({ pool: { execute } as unknown as Pool, database: 'mastra' });

    await expect(
      operations.pruneBatch({
        tableName: TABLE_SPANS,
        column: 'startedAt',
        cutoff: new Date('2026-01-01T00:00:00.000Z'),
        limit: '1; DROP TABLE mastra_ai_spans' as unknown as number,
      }),
    ).rejects.toThrow('Retention batch limit must be a positive safe integer');
    expect(execute).not.toHaveBeenCalled();
  });

  it('interpolates a validated limit while binding the cutoff', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 2 }]);
    const operations = new StoreOperationsMySQL({ pool: { execute } as unknown as Pool, database: 'mastra' });
    const cutoff = new Date('2026-01-01T00:00:00.000Z');

    await expect(
      operations.pruneBatch({ tableName: TABLE_SPANS, column: 'startedAt', cutoff, limit: 2 }),
    ).resolves.toBe(2);
    expect(execute).toHaveBeenCalledWith(
      'DELETE FROM `mastra`.`mastra_ai_spans` WHERE `startedAt` < ? ORDER BY `startedAt` LIMIT 2',
      [cutoff],
    );
  });
});
