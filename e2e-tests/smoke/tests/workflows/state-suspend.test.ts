import { describe, it, expect } from 'vitest';
import { startWorkflow, resumeWorkflow } from '../utils.js';

describe('state + suspend/resume workflows', () => {
  describe('state-suspend-workflow', () => {
    it('should persist state across a suspend/resume cycle', async () => {
      const { runId, data: startData } = await startWorkflow('state-suspend-workflow', {
        inputData: { action: 'deploy' },
        initialState: { count: 0, log: [] },
      });

      expect(startData.status).toBe('suspended');

      // The suspend payload should include state set before suspension
      expect(startData.suspendPayload).toHaveProperty('suspend-for-approval');
      expect(startData.suspendPayload['suspend-for-approval']).toMatchObject({
        pendingAction: 'deploy',
        currentCount: 1, // incremented by first step
      });

      // Resume with approval
      const { data: resumeData } = await resumeWorkflow('state-suspend-workflow', runId, {
        step: 'suspend-for-approval',
        resumeData: { approved: true },
      });

      expect(resumeData.status).toBe('success');
      // The suspend step executes twice: once for suspend (logs false), once for resume (logs true).
      // So count = 4 (step-one + suspend-initial + suspend-resume + finalize).
      expect(resumeData.result).toEqual({
        finalCount: 4,
        finalLog: ['before-suspend:deploy', 'after-resume:false', 'after-resume:true', 'finalize:true'],
        approved: true,
      });
    });

    it('should persist state across suspend/resume with rejection', async () => {
      const { runId } = await startWorkflow('state-suspend-workflow', {
        inputData: { action: 'rollback' },
        initialState: { count: 0, log: [] },
      });

      const { data } = await resumeWorkflow('state-suspend-workflow', runId, {
        step: 'suspend-for-approval',
        resumeData: { approved: false },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        finalCount: 4,
        finalLog: ['before-suspend:rollback', 'after-resume:false', 'after-resume:false', 'finalize:false'],
        approved: false,
      });
    });
  });

  describe('state-loop-workflow', () => {
    it('should accumulate state inside a dowhile loop', async () => {
      const { data } = await startWorkflow('state-loop-workflow', {
        inputData: { iteration: 0 },
        initialState: { count: 0, log: [] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({
        iterations: 3,
        stateCount: 3, // 3 loop iterations
        stateLog: ['iteration:1', 'iteration:2', 'iteration:3'],
      });
    });
  });

  describe('state-parallel-workflow', () => {
    it('should allow state access in parallel branches', async () => {
      const { data } = await startWorkflow('state-parallel-workflow', {
        inputData: { value: 5 },
        initialState: { count: 0, log: [] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toMatchObject({
        'parallel-branch-alpha': { alpha: 10 },
        'parallel-branch-beta': { beta: 15 },
      });
    });
  });
});
