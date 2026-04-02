import { describe, it, expect } from 'vitest';
import { ReadableStream } from 'node:stream/web';
import { WorkflowRunOutput } from './RunOutput';
import type { WorkflowStreamEvent } from './types';
import { ChunkFrom } from './types';

function createErrorStream(error: Error): ReadableStream<WorkflowStreamEvent> {
  return new ReadableStream<WorkflowStreamEvent>({
    start(controller) {
      controller.enqueue({
        type: 'workflow-step-output',
        runId: 'test-run',
        from: ChunkFrom.WORKFLOW,
        payload: {
          stepId: 'step-1',
          output: { type: 'text-delta', payload: { textDelta: 'partial' } },
        },
      } as WorkflowStreamEvent);

      controller.error(error);
    },
  });
}

function createNormalStream(): ReadableStream<WorkflowStreamEvent> {
  return new ReadableStream<WorkflowStreamEvent>({
    start(controller) {
      controller.enqueue({
        type: 'workflow-step-output',
        runId: 'test-run',
        from: ChunkFrom.WORKFLOW,
        payload: {
          stepId: 'step-1',
          output: { type: 'text-delta', payload: { textDelta: 'hello' } },
        },
      } as WorkflowStreamEvent);

      controller.close();
    },
  });
}

describe('WorkflowRunOutput', () => {
  describe('stream pipeline error handling', () => {
    it('should set status to failed when stream errors', async () => {
      const streamError = new Error('S3 connection dropped');
      const output = new WorkflowRunOutput({
        runId: 'test-run',
        workflowId: 'test-workflow',
        stream: createErrorStream(streamError),
      });

      // Wait for the stream pipeline to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(output.status).toBe('failed');
    });

    it('should reject the result promise when stream errors', async () => {
      const streamError = new Error('network failure');
      const output = new WorkflowRunOutput({
        runId: 'test-run',
        workflowId: 'test-workflow',
        stream: createErrorStream(streamError),
      });

      await expect(output.result).rejects.toThrow('network failure');
    });

    it('should emit workflow-finish with failed status when stream errors', async () => {
      const streamError = new Error('stream broke');
      const output = new WorkflowRunOutput({
        runId: 'test-run',
        workflowId: 'test-workflow',
        stream: createErrorStream(streamError),
      });

      const chunks: WorkflowStreamEvent[] = [];
      const reader = output.fullStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } catch {
        // stream may error
      }

      const finishChunk = chunks.find(c => c.type === 'workflow-finish');
      expect(finishChunk).toBeDefined();
      expect(finishChunk!.payload).toMatchObject({
        workflowStatus: 'failed',
        metadata: {
          errorMessage: 'stream broke',
        },
      });
    });

    it('should resolve usage even when stream errors', async () => {
      const streamError = new Error('oops');
      const output = new WorkflowRunOutput({
        runId: 'test-run',
        workflowId: 'test-workflow',
        stream: createErrorStream(streamError),
      });

      const usage = await output.usage;
      expect(usage).toMatchObject({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });

    it('should complete normally when stream succeeds', async () => {
      const output = new WorkflowRunOutput({
        runId: 'test-run',
        workflowId: 'test-workflow',
        stream: createNormalStream(),
      });

      // Wait for stream to finish
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(output.status).toBe('success');
    });

    it('should handle resume stream errors the same way', async () => {
      const output = new WorkflowRunOutput({
        runId: 'test-run',
        workflowId: 'test-workflow',
        stream: createNormalStream(),
      });

      // Wait for normal stream to finish
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(output.status).toBe('success');

      // Resume with an erroring stream
      const resumeError = new Error('resume connection lost');
      output.resume(createErrorStream(resumeError));

      await expect(output.result).rejects.toThrow('resume connection lost');
      expect(output.status).toBe('failed');
    });
  });
});
