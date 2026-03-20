import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('state workflows', () => {
  describe('stateful-workflow', () => {
    it('should accumulate state across steps', async () => {
      const { data } = await startWorkflow('stateful-workflow', {
        inputData: { action: 'test' },
        // Must provide initialState matching stateSchema since validation is strict
        initialState: { count: 0, log: [] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        finalCount: 2,
        finalLog: ['step-one:test', 'step-two:test'],
      });
    });
  });

  describe('initial-state', () => {
    it('should start with provided initialState', async () => {
      const { data } = await startWorkflow('initial-state', {
        inputData: { addValue: 'injected' },
        initialState: { count: 5, log: ['pre-existing'] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        originalCount: 5,
        newCount: 15,
        log: ['pre-existing', 'injected'],
      });
    });
  });
});
