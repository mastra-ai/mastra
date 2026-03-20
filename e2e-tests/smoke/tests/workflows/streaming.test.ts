import { describe, it, expect } from 'vitest';
import { streamWorkflow, streamResumeWorkflow } from '../utils.js';

describe('streaming workflows', () => {
  describe('stream execution', () => {
    it('should stream sequential-steps with proper chunk types', async () => {
      const { runId, chunks } = await streamWorkflow('sequential-steps', {
        inputData: { name: 'stream-test' },
      });

      // Should have workflow-start, step events, and workflow-finish
      const types = chunks.map((c: any) => c.type);
      expect(types[0]).toBe('workflow-start');
      expect(types[types.length - 1]).toBe('workflow-finish');
      expect(types).toContain('workflow-step-start');
      expect(types).toContain('workflow-step-result');

      // workflow-start should identify the workflow
      expect(chunks[0].payload.workflowId).toBe('sequential-steps');
      expect(chunks[0].runId).toBe(runId);

      // Should have step results for each of the 3 steps
      const stepResults = chunks.filter((c: any) => c.type === 'workflow-step-result');
      expect(stepResults.length).toBe(3);

      // Final step result should contain the combined message
      const lastStepResult = stepResults[stepResults.length - 1];
      expect(lastStepResult.payload.output).toEqual({
        message: 'Hello, stream-test! Goodbye, stream-test!',
      });

      // workflow-finish should report success
      const finish = chunks[chunks.length - 1];
      expect(finish.payload.workflowStatus).toBe('success');
    });
  });

  describe('stream suspend/resume', () => {
    it('should stream suspend then stream resume with proper events', async () => {
      const { runId, chunks: startChunks } = await streamWorkflow('basic-suspend', {
        inputData: { item: 'stream-suspend-test' },
      });

      // Start stream should end with workflow-finish in suspended state
      const startTypes = startChunks.map((c: any) => c.type);
      expect(startTypes[0]).toBe('workflow-start');
      expect(startTypes).toContain('workflow-step-suspended');
      const startFinish = startChunks[startChunks.length - 1];
      expect(startFinish.type).toBe('workflow-finish');
      expect(startFinish.payload.workflowStatus).toBe('suspended');

      // The suspended chunk should identify the step
      const suspendedChunk = startChunks.find((c: any) => c.type === 'workflow-step-suspended');
      expect(suspendedChunk.payload.stepName).toBe('await-approval');

      // Resume stream
      const { chunks: resumeChunks } = await streamResumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      });

      // Resume stream should complete successfully
      const resumeTypes = resumeChunks.map((c: any) => c.type);
      expect(resumeTypes[0]).toBe('workflow-start');
      const resumeFinish = resumeChunks[resumeChunks.length - 1];
      expect(resumeFinish.type).toBe('workflow-finish');
      expect(resumeFinish.payload.workflowStatus).toBe('success');

      // Should have the finalize step result
      const finalResult = resumeChunks.find(
        (c: any) => c.type === 'workflow-step-result' && c.payload.stepName === 'finalize',
      );
      expect(finalResult.payload.output).toEqual({
        result: 'stream-suspend-test approved',
      });
    });
  });
});
