import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('error handling workflows', () => {
  describe('retry-workflow', () => {
    it('should succeed after retries', async () => {
      const { data } = await startWorkflow('retry-workflow', {
        inputData: { message: 'retry-test' },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ result: 'retry-test', attempts: 3 });
    });
  });

  describe('failure-workflow', () => {
    it('should report failed status with the intentional error', async () => {
      const { data } = await startWorkflow('failure-workflow', {
        inputData: { input: 'will-fail' },
      });

      expect(data.status).toBe('failed');
      expect(data.error).toEqual({
        message: 'Intentional failure for smoke test',
        name: 'Error',
      });
    });
  });
});
