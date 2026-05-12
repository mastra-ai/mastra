import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('foreach error handling', () => {
  describe('foreach-error-workflow', () => {
    it('should fail when an item in foreach throws', async () => {
      const { data } = await startWorkflow('foreach-error-workflow', {
        inputData: { items: ['good', 'FAIL', 'also-good'] },
      });

      expect(data.status).toBe('failed');
      expect(data.error).toEqual({
        message: 'Item "FAIL" failed processing',
        name: 'Error',
      });
    });

    it('should succeed when no items throw', async () => {
      const { data } = await startWorkflow('foreach-error-workflow', {
        inputData: { items: ['alpha', 'beta'] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual([
        { processed: 'ALPHA' },
        { processed: 'BETA' },
      ]);
    });
  });

  describe('foreach-retry-workflow', () => {
    it('should retry a flaky item and succeed', async () => {
      const { data } = await startWorkflow('foreach-retry-workflow', {
        inputData: { items: ['stable', 'flaky'] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual([
        { processed: 'STABLE', attempts: 1 },
        { processed: 'FLAKY', attempts: 2 },
      ]);
    });
  });
});
