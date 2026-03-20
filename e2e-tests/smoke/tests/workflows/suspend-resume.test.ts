import { describe, it, expect } from 'vitest';
import { startWorkflow, resumeWorkflow } from '../utils.js';

describe('suspend/resume workflows', () => {
  describe('basic-suspend', () => {
    it('should suspend and return suspend payload', async () => {
      const { data } = await startWorkflow('basic-suspend', {
        inputData: { item: 'report' },
      });

      expect(data.status).toBe('suspended');
    });

    it('should resume with data and complete', async () => {
      const { runId, data: startData } = await startWorkflow('basic-suspend', {
        inputData: { item: 'report' },
      });

      expect(startData.status).toBe('suspended');

      const { data: resumeData } = await resumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      });

      expect(resumeData.status).toBe('success');
      expect(resumeData.result).toEqual({ result: 'report approved' });
    });

    it('should handle rejection on resume', async () => {
      const { runId } = await startWorkflow('basic-suspend', {
        inputData: { item: 'expense' },
      });

      const { data } = await resumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: false },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual({ result: 'expense rejected' });
    });
  });

  describe('parallel-suspend', () => {
    it('should suspend both parallel branches', async () => {
      const { data } = await startWorkflow('parallel-suspend', {
        inputData: { value: 1 },
      });

      expect(data.status).toBe('suspended');
    });

    it('should resume individual branches by step ID', async () => {
      const { runId } = await startWorkflow('parallel-suspend', {
        inputData: { value: 1 },
      });

      // Resume branch A
      const { data: afterA } = await resumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-a',
        resumeData: { dataA: 'value-a' },
      });

      // Resume branch B
      const { data: afterB } = await resumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-b',
        resumeData: { dataB: 'value-b' },
      });

      expect(afterB.status).toBe('success');
      const resultStr = JSON.stringify(afterB.result);
      expect(resultStr).toContain('value-a');
      expect(resultStr).toContain('value-b');
    });
  });

  describe('loop-suspend', () => {
    it('should suspend on each loop iteration and resume', async () => {
      const { runId, data: iter0 } = await startWorkflow('loop-suspend', {
        inputData: { iteration: 0, items: [] },
      });
      expect(iter0.status).toBe('suspended');

      const { data: iter1 } = await resumeWorkflow('loop-suspend', runId, {
        step: 'loop-with-suspend',
        resumeData: { value: 'first' },
      });
      expect(iter1.status).toBe('suspended');

      const { data: iter2 } = await resumeWorkflow('loop-suspend', runId, {
        step: 'loop-with-suspend',
        resumeData: { value: 'second' },
      });
      expect(iter2.status).toBe('suspended');

      const { data: final } = await resumeWorkflow('loop-suspend', runId, {
        step: 'loop-with-suspend',
        resumeData: { value: 'third' },
      });
      expect(final.status).toBe('success');
      expect(final.result).toEqual({
        iteration: 3,
        items: ['first', 'second', 'third'],
      });
    });
  });
});
