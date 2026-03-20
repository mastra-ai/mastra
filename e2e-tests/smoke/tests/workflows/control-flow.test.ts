import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('control flow workflows', () => {
  describe('branch-workflow', () => {
    it('should take the positive branch for positive values', async () => {
      const { data } = await startWorkflow('branch-workflow', {
        inputData: { value: 42 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        'handle-positive': { result: 'Positive: 42' },
      });
    });

    it('should take the negative branch for negative values', async () => {
      const { data } = await startWorkflow('branch-workflow', {
        inputData: { value: -7 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        'handle-negative': { result: 'Negative: -7' },
      });
    });

    it('should take the positive branch for value 0 (boundary: >= 0)', async () => {
      const { data } = await startWorkflow('branch-workflow', {
        inputData: { value: 0 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        'handle-positive': { result: 'Positive: 0' },
      });
    });
  });

  describe('parallel-workflow', () => {
    it('should execute all 3 steps concurrently and collect results', async () => {
      const { data } = await startWorkflow('parallel-workflow', {
        inputData: { value: 5 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        'compute-square': { square: 25 },
        'compute-double': { double: 10 },
        'compute-negate': { negated: -5 },
      });
    });
  });

  describe('dowhile-workflow', () => {
    it('should loop until count reaches 5', async () => {
      const { data } = await startWorkflow('dowhile-workflow', {
        inputData: { count: 0 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ count: 5 });
    });

    it('should execute at least once even when starting at threshold (do-while semantics)', async () => {
      const { data } = await startWorkflow('dowhile-workflow', {
        inputData: { count: 5 },
      });

      // do-while: body executes first, then condition is checked.
      // count starts at 5 → increments to 6 → condition (6 < 5) is false → stops.
      expect(data.status).toBe('success');
      expect(data.result).toEqual({ count: 6 });
    });
  });

  describe('dountil-workflow', () => {
    it('should accumulate until total reaches 50', async () => {
      const { data } = await startWorkflow('dountil-workflow', {
        inputData: { total: 0 },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ total: 50 });
    });

    it('should execute at least once even when starting at threshold (do-until semantics)', async () => {
      const { data } = await startWorkflow('dountil-workflow', {
        inputData: { total: 50 },
      });

      // do-until: body executes first, then condition is checked.
      // total starts at 50 → adds 10 → 60 → condition (60 >= 50) is true → stops.
      expect(data.status).toBe('success');
      expect(data.result).toEqual({ total: 60 });
    });
  });

  describe('foreach-workflow', () => {
    it('should process each item in the array', async () => {
      const { data } = await startWorkflow('foreach-workflow', {
        inputData: { items: ['hello', 'world', 'test'] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual([
        { processed: 'HELLO' },
        { processed: 'WORLD' },
        { processed: 'TEST' },
      ]);
    });
  });
});
