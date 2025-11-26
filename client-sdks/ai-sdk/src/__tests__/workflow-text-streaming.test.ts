import { describe, it, expect, vi } from 'vitest';
import { WorkflowStreamToAISDKTransformer } from '../transformers';

describe('WorkflowStreamToAISDKTransformer', () => {
  it('should extract text-delta events from workflow-step-output when sendText is true', async () => {
    const transformer = WorkflowStreamToAISDKTransformer(true);
    const reader = new ReadableStream({
      start(controller) {
        // Simulate workflow start
        controller.enqueue({
          type: 'workflow-start',
          runId: 'workflow-123',
          payload: { workflowId: 'test-workflow' },
        });

        // Simulate workflow step output with nested agent text-start
        controller.enqueue({
          type: 'workflow-step-output',
          runId: 'workflow-123',
          payload: {
            output: {
              type: 'text-start',
              runId: 'agent-456',
            },
          },
        });

        // Simulate workflow step output with nested agent text-delta
        controller.enqueue({
          type: 'workflow-step-output',
          runId: 'workflow-123',
          payload: {
            output: {
              type: 'text-delta',
              runId: 'agent-456',
              payload: { text: 'Hello, ' },
            },
          },
        });

        // Another text-delta
        controller.enqueue({
          type: 'workflow-step-output',
          runId: 'workflow-123',
          payload: {
            output: {
              type: 'text-delta',
              runId: 'agent-456',
              payload: { text: 'world!' },
            },
          },
        });

        controller.close();
      },
    });

    const transformedStream = reader.pipeThrough(transformer);
    const chunks = [];
    const transformedReader = transformedStream.getReader();

    while (true) {
      const { done, value } = await transformedReader.read();
      if (done) break;
      chunks.push(value);
    }

    // Check that we have the expected chunks
    expect(chunks).toContainEqual({ type: 'start' });
    expect(chunks).toContainEqual({ type: 'text-start', id: 'agent-456' });
    expect(chunks).toContainEqual({ type: 'text-delta', id: 'agent-456', delta: 'Hello, ' });
    expect(chunks).toContainEqual({ type: 'text-delta', id: 'agent-456', delta: 'world!' });
    expect(chunks).toContainEqual({ type: 'finish' });

    // Also check that we have workflow metadata
    const workflowDataChunks = chunks.filter(c => c.type === 'data-workflow');
    expect(workflowDataChunks.length).toBeGreaterThan(0);
  });

  it('should not extract text events when sendText is false', async () => {
    const transformer = WorkflowStreamToAISDKTransformer(false);
    const reader = new ReadableStream({
      start(controller) {
        // Simulate workflow start
        controller.enqueue({
          type: 'workflow-start',
          runId: 'workflow-123',
          payload: { workflowId: 'test-workflow' },
        });

        // Simulate workflow step output with nested agent text-delta
        controller.enqueue({
          type: 'workflow-step-output',
          runId: 'workflow-123',
          payload: {
            output: {
              type: 'text-delta',
              runId: 'agent-456',
              payload: { text: 'Hello, world!' },
            },
          },
        });

        controller.close();
      },
    });

    const transformedStream = reader.pipeThrough(transformer);
    const chunks = [];
    const transformedReader = transformedStream.getReader();

    while (true) {
      const { done, value } = await transformedReader.read();
      if (done) break;
      chunks.push(value);
    }

    // Check that we don't have text events
    expect(chunks).not.toContainEqual(expect.objectContaining({ type: 'text-start' }));
    expect(chunks).not.toContainEqual(expect.objectContaining({ type: 'text-delta' }));

    // But we should still have workflow structure
    expect(chunks).toContainEqual({ type: 'start' });
    expect(chunks).toContainEqual({ type: 'finish' });
  });
});
