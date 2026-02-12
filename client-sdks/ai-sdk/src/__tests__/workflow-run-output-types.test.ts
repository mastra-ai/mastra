import type { WorkflowStreamEvent } from '@mastra/core/stream';
import { ChunkFrom, WorkflowRunOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { toAISdkV5Stream } from '../convert-streams';

/**
 * TYPE ERROR FIX: toAISdkStream with WorkflowRunOutput
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/12565
 * PR: https://github.com/mastra-ai/mastra/pull/12777
 *
 * Problem:
 * When calling `toAISdkStream(run.stream(), { from: "workflow" })`, TypeScript threw:
 *   TS2769: Argument of type 'WorkflowRunOutput<...>' is not assignable to
 *   parameter of type 'MastraModelOutput<unknown>'.
 *
 * Root Causes:
 * 1. Type overload union order: WorkflowRunOutput was listed after MastraModelOutput,
 *    causing TypeScript to select the wrong overload
 * 2. Runtime handling: The code cast directly to ReadableStream without extracting
 *    the fullStream property from WorkflowRunOutput
 *
 * The Fix:
 * 1. Reordered union type to prioritize WorkflowRunOutput first
 * 2. Added runtime check: if input has 'fullStream', use it; otherwise use stream directly
 *
 * This test verifies:
 * - WorkflowRunOutput is accepted by toAISdkStream without type errors
 * - The fullStream is properly extracted and transformed
 * - Both run.stream() and run.resumeStream() work correctly
 */

describe('toAISdkStream with WorkflowRunOutput type fix', () => {
  it('should accept WorkflowRunOutput without TypeScript errors', async () => {
    // Create a mock workflow stream
    const mockWorkflowStream = new ReadableStream<WorkflowStreamEvent>({
      start(controller) {
        controller.enqueue({
          type: 'workflow-step-start',
          runId: 'run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            id: 'step-1',
            stepCallId: 'call-1',
            status: 'running',
            payload: {},
          },
        });

        controller.enqueue({
          type: 'workflow-step-result',
          runId: 'run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            id: 'step-1',
            stepCallId: 'call-1',
            status: 'success',
            output: { result: 'done' },
          },
        });

        controller.enqueue({
          type: 'workflow-finish',
          runId: 'run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            metadata: {},
            workflowStatus: 'success',
            output: {
              usage: {
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
              },
            },
          },
        });

        controller.close();
      },
    });

    // Create a WorkflowRunOutput (simulating run.stream())
    const workflowRunOutput = new WorkflowRunOutput({
      runId: 'run-1',
      workflowId: 'test-workflow',
      stream: mockWorkflowStream,
    });

    // This should NOT throw a TypeScript error (TS2769)
    // Before the fix, this line would fail compilation
    const aiSdkStream = toAISdkV5Stream(workflowRunOutput, {
      from: 'workflow',
    });

    // Verify the stream works correctly
    expect(aiSdkStream).toBeDefined();
    expect(aiSdkStream.getReader).toBeDefined();

    // Consume the stream to verify it transforms correctly
    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // Should have start, workflow data chunks, and finish
    expect(chunks[0]).toEqual({ type: 'start' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish' });

    // Should have workflow data chunks
    const workflowDataChunks = chunks.filter(chunk => chunk.type === 'data-workflow');
    expect(workflowDataChunks.length).toBeGreaterThan(0);
  });

  it('should extract fullStream from WorkflowRunOutput', async () => {
    // This test verifies that the runtime code properly extracts fullStream
    // from WorkflowRunOutput instead of trying to use it directly as a ReadableStream

    const mockWorkflowStream = new ReadableStream<WorkflowStreamEvent>({
      start(controller) {
        controller.enqueue({
          type: 'workflow-step-start',
          runId: 'run-2',
          from: ChunkFrom.WORKFLOW,
          payload: {
            id: 'step-1',
            stepCallId: 'call-1',
            status: 'running',
          },
        });

        controller.enqueue({
          type: 'workflow-finish',
          runId: 'run-2',
          from: ChunkFrom.WORKFLOW,
          payload: {
            metadata: {},
            workflowStatus: 'success',
            output: {
              usage: {
                inputTokens: 5,
                outputTokens: 10,
                totalTokens: 15,
              },
            },
          },
        });

        controller.close();
      },
    });

    const workflowRunOutput = new WorkflowRunOutput({
      runId: 'run-2',
      workflowId: 'test-workflow',
      stream: mockWorkflowStream,
    });

    // Verify that WorkflowRunOutput has fullStream property
    expect(workflowRunOutput.fullStream).toBeDefined();
    expect(workflowRunOutput.fullStream.getReader).toBeDefined();

    // The fix should check for 'fullStream' and use it
    const aiSdkStream = toAISdkV5Stream(workflowRunOutput, {
      from: 'workflow',
    });

    // Consume and verify
    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(2); // start + workflow chunks + finish
    expect(chunks[0].type).toBe('start');
    expect(chunks[chunks.length - 1].type).toBe('finish');
  });

  it('should handle plain ReadableStream (legacy behavior)', async () => {
    // Verify that plain ReadableStream still works (backwards compatibility)
    const plainStream = new ReadableStream<WorkflowStreamEvent>({
      start(controller) {
        controller.enqueue({
          type: 'workflow-start',
          runId: 'run-3',
          from: ChunkFrom.WORKFLOW,
          payload: {
            workflowId: 'test-workflow',
          },
        });

        controller.enqueue({
          type: 'workflow-finish',
          runId: 'run-3',
          from: ChunkFrom.WORKFLOW,
          payload: {
            metadata: {},
            workflowStatus: 'success',
            output: {
              usage: {
                inputTokens: 3,
                outputTokens: 7,
                totalTokens: 10,
              },
            },
          },
        });

        controller.close();
      },
    });

    // Plain ReadableStream should still work
    const aiSdkStream = toAISdkV5Stream(plainStream as any, {
      from: 'workflow',
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    expect(chunks[0]).toEqual({ type: 'start' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish' });
  });

  it('should work with resumeStream (which also returns WorkflowRunOutput)', async () => {
    // resumeStream() also returns WorkflowRunOutput, so it should work the same way
    const mockResumeStream = new ReadableStream<WorkflowStreamEvent>({
      start(controller) {
        // Simulate resume starting from a suspended step
        controller.enqueue({
          type: 'workflow-step-start',
          runId: 'run-4',
          from: ChunkFrom.WORKFLOW,
          payload: {
            id: 'step-2',
            stepCallId: 'call-2',
            status: 'running',
          },
        });

        controller.enqueue({
          type: 'workflow-step-result',
          runId: 'run-4',
          from: ChunkFrom.WORKFLOW,
          payload: {
            id: 'step-2',
            stepCallId: 'call-2',
            status: 'success',
            output: { resumed: true },
          },
        });

        controller.enqueue({
          type: 'workflow-finish',
          runId: 'run-4',
          from: ChunkFrom.WORKFLOW,
          payload: {
            metadata: {},
            workflowStatus: 'success',
            output: {
              usage: {
                inputTokens: 2,
                outputTokens: 5,
                totalTokens: 7,
              },
            },
          },
        });

        controller.close();
      },
    });

    const resumedWorkflowRunOutput = new WorkflowRunOutput({
      runId: 'run-4',
      workflowId: 'test-workflow',
      stream: mockResumeStream,
    });

    // This should also work without type errors
    const aiSdkStream = toAISdkV5Stream(resumedWorkflowRunOutput, {
      from: 'workflow',
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe('start');
    expect(chunks[chunks.length - 1].type).toBe('finish');
  });

  it('type test: should compile with WorkflowRunOutput from workflow methods', () => {
    // This is a compile-time test to ensure types work correctly
    // If this compiles without errors, the type fix is working

    // Simulating the type that run.stream() returns
    declare const runStream: WorkflowRunOutput<any>;
    declare const resumeStream: WorkflowRunOutput<any>;

    // These should all compile without TS2769 errors
    const stream1 = toAISdkV5Stream(runStream, { from: 'workflow' });
    const stream2 = toAISdkV5Stream(resumeStream, { from: 'workflow' });
    const stream3 = toAISdkV5Stream(runStream, {
      from: 'workflow',
      includeTextStreamParts: true,
    });
    const stream4 = toAISdkV5Stream(resumeStream, {
      from: 'workflow',
      sendReasoning: true,
      sendSources: true,
    });

    // If this test compiles, the type fix is working
    expect(stream1).toBeDefined();
    expect(stream2).toBeDefined();
    expect(stream3).toBeDefined();
    expect(stream4).toBeDefined();
  });
});
