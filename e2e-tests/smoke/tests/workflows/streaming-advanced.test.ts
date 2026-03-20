import { describe, it, expect } from 'vitest';
import { streamWorkflow, streamResumeWorkflow } from '../utils.js';

describe('advanced streaming', () => {
  describe('stream failure', () => {
    it('should stream a failed workflow with error event', async () => {
      const { chunks } = await streamWorkflow('failure-workflow', {
        inputData: { input: 'stream-fail' },
      });

      const types = chunks.map((c: any) => c.type);
      expect(types[0]).toBe('workflow-start');
      expect(types[types.length - 1]).toBe('workflow-finish');

      // workflow-finish should report failed status
      const finish = chunks[chunks.length - 1];
      expect(finish.payload.workflowStatus).toBe('failed');
    });
  });

  describe('stream retry', () => {
    it('should stream a workflow that retries and eventually succeeds', async () => {
      const { chunks } = await streamWorkflow('retry-workflow', {
        inputData: { message: 'stream-retry' },
      });

      const types = chunks.map((c: any) => c.type);
      expect(types[0]).toBe('workflow-start');
      expect(types[types.length - 1]).toBe('workflow-finish');

      // Should complete successfully after retries
      const finish = chunks[chunks.length - 1];
      expect(finish.payload.workflowStatus).toBe('success');

      // Should have a step result with the successful output
      const stepResults = chunks.filter((c: any) => c.type === 'workflow-step-result');
      expect(stepResults.length).toBeGreaterThanOrEqual(1);
      const lastResult = stepResults[stepResults.length - 1];
      expect(lastResult.payload.output).toEqual({
        result: 'stream-retry',
        attempts: 3,
      });
    });
  });

  describe('stream parallel suspend', () => {
    it('should stream parallel suspend events for multiple branches', async () => {
      const { runId, chunks: startChunks } = await streamWorkflow('parallel-suspend', {
        inputData: { value: 42 },
      });

      const startTypes = startChunks.map((c: any) => c.type);
      expect(startTypes[0]).toBe('workflow-start');

      // Should have suspended events for both branches
      const suspendedChunks = startChunks.filter((c: any) => c.type === 'workflow-step-suspended');
      const suspendedSteps = suspendedChunks.map((c: any) => c.payload.stepName).sort();
      expect(suspendedSteps).toEqual(['suspend-branch-a', 'suspend-branch-b']);

      // Finish should be suspended
      const finish = startChunks[startChunks.length - 1];
      expect(finish.type).toBe('workflow-finish');
      expect(finish.payload.workflowStatus).toBe('suspended');

      // Resume branch A via stream
      const { chunks: resumeAChunks } = await streamResumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-a',
        resumeData: { dataA: 'streamed-a' },
      });

      const resumeAFinish = resumeAChunks[resumeAChunks.length - 1];
      expect(resumeAFinish.type).toBe('workflow-finish');

      // After resuming A, B may still be suspended or the workflow may already be complete
      // depending on internal parallel resolution. Either outcome is valid.
      if (resumeAFinish.payload.workflowStatus === 'suspended') {
        // Resume branch B via stream
        const { chunks: resumeBChunks } = await streamResumeWorkflow('parallel-suspend', runId, {
          step: 'suspend-branch-b',
          resumeData: { dataB: 'streamed-b' },
        });

        const resumeBFinish = resumeBChunks[resumeBChunks.length - 1];
        expect(resumeBFinish.type).toBe('workflow-finish');
        expect(resumeBFinish.payload.workflowStatus).toBe('success');
      } else {
        expect(resumeAFinish.payload.workflowStatus).toBe('success');
      }
    });
  });
});
