import { describe, it, expect } from 'vitest';
import { splitIntoBatches, DEFAULT_MAX_ROWS_PER_BATCH } from './batch';

describe('batch utilities', () => {
  describe('splitIntoBatches', () => {
    it('should return empty result for empty array', () => {
      const result = splitIntoBatches([]);
      expect(result.batches).toEqual([]);
      expect(result.totalRecords).toBe(0);
      expect(result.batchCount).toBe(0);
    });

    it('should return single batch for records below maxRows', () => {
      const records = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = splitIntoBatches(records);
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toEqual(records);
      expect(result.totalRecords).toBe(3);
      expect(result.batchCount).toBe(1);
    });

    it('should split records into multiple batches when exceeding maxRows', () => {
      const records = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      const result = splitIntoBatches(records, { maxRows: 3 });
      expect(result.batches).toHaveLength(4);
      expect(result.batches[0]).toHaveLength(3);
      expect(result.batches[1]).toHaveLength(3);
      expect(result.batches[2]).toHaveLength(3);
      expect(result.batches[3]).toHaveLength(1);
      expect(result.totalRecords).toBe(10);
      expect(result.batchCount).toBe(4);
    });

    it('should use DEFAULT_MAX_ROWS_PER_BATCH (3000) by default', () => {
      expect(DEFAULT_MAX_ROWS_PER_BATCH).toBe(3000);
      const records = Array.from({ length: 3001 }, (_, i) => ({ id: i }));
      const result = splitIntoBatches(records);
      expect(result.batches).toHaveLength(2);
      expect(result.batches[0]).toHaveLength(3000);
      expect(result.batches[1]).toHaveLength(1);
    });

    it('should handle exactly maxRows records', () => {
      const records = Array.from({ length: 3000 }, (_, i) => ({ id: i }));
      const result = splitIntoBatches(records);
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toHaveLength(3000);
    });

    it('should throw error for invalid maxRows', () => {
      const records = [{ id: 1 }];
      expect(() => splitIntoBatches(records, { maxRows: 0 })).toThrow('maxRows must be a positive number');
      expect(() => splitIntoBatches(records, { maxRows: -1 })).toThrow('maxRows must be a positive number');
    });

    it('should preserve original objects in batches', () => {
      const obj1 = { id: 1, data: 'test' };
      const obj2 = { id: 2, data: 'test2' };
      const result = splitIntoBatches([obj1, obj2], { maxRows: 1 });
      expect(result.batches[0][0]).toBe(obj1);
      expect(result.batches[1][0]).toBe(obj2);
    });
  });
});
