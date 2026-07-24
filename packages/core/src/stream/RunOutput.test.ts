import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import { WorkflowRunOutput } from './RunOutput';
import { ChunkFrom } from './types';
import type { WorkflowStreamEvent } from './types';

function createWorkflowStream(chunks: WorkflowStreamEvent[]): ReadableStream<WorkflowStreamEvent> {
  return new ReadableStream<WorkflowStreamEvent>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createWorkflowStepOutput(usage: Record<string, unknown>): WorkflowStreamEvent {
  return {
    type: 'workflow-step-output',
    runId: 'run-1',
    from: ChunkFrom.WORKFLOW,
    payload: {
      id: 'step-output',
      stepId: 'step-1',
      output: {
        type: 'finish',
        payload: {
          usage,
        },
      },
    },
  } as WorkflowStreamEvent;
}

describe('WorkflowRunOutput', () => {
  it('should sum cacheCreationInputTokens across workflow step outputs', async () => {
    const output = new WorkflowRunOutput({
      runId: 'run-1',
      workflowId: 'workflow-1',
      stream: createWorkflowStream([
        createWorkflowStepOutput({
          inputTokens: 4557,
          outputTokens: 113,
          totalTokens: 4670,
          cachedInputTokens: 3584,
          cacheCreationInputTokens: 967,
        }),
        createWorkflowStepOutput({
          inputTokens: 4848,
          outputTokens: 117,
          totalTokens: 4965,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 296,
        }),
        createWorkflowStepOutput({
          inputTokens: 8557,
          outputTokens: 1270,
          totalTokens: 9827,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 4005,
        }),
      ]),
    });

    const usage = await output.usage;

    expect(usage.inputTokens).toBe(17962);
    expect(usage.outputTokens).toBe(1500);
    expect(usage.cachedInputTokens).toBe(12686);
    expect((usage as { cacheCreationInputTokens?: number }).cacheCreationInputTokens).toBe(5268);
  });

  it('does not stop other fullStream subscribers when one subscriber cancels (#19743)', async () => {
    let enqueue: (chunk: WorkflowStreamEvent) => void = () => {};
    let closeSource: () => void = () => {};
    const source = new ReadableStream<WorkflowStreamEvent>({
      start(controller) {
        enqueue = chunk => controller.enqueue(chunk);
        closeSource = () => controller.close();
      },
    });

    const output = new WorkflowRunOutput({
      runId: 'run-1',
      workflowId: 'workflow-1',
      stream: source,
    });

    const receivedByA: WorkflowStreamEvent[] = [];
    let aClosed = false;
    const consumeA = (async () => {
      for await (const chunk of output.fullStream as unknown as AsyncIterable<WorkflowStreamEvent>) {
        receivedByA.push(chunk);
      }
      aClosed = true;
    })();

    // Let consumer A's start() register its listeners before anything is enqueued.
    await Promise.resolve();
    await Promise.resolve();

    // Consumer B attaches, reads one chunk, then cancels — simulating a client
    // disconnect on a second /stream request for the same run.
    const readerB = output.fullStream.getReader();
    enqueue(createWorkflowStepOutput({ inputTokens: 1, outputTokens: 1, totalTokens: 2, cachedInputTokens: 0 }));
    await readerB.read();
    await readerB.cancel();

    // More chunks arrive after B has cancelled — A must still receive them.
    enqueue(createWorkflowStepOutput({ inputTokens: 2, outputTokens: 2, totalTokens: 4, cachedInputTokens: 0 }));
    enqueue(createWorkflowStepOutput({ inputTokens: 3, outputTokens: 3, totalTokens: 6, cachedInputTokens: 0 }));
    closeSource();

    await consumeA;

    expect(aClosed).toBe(true);
    expect(receivedByA.length).toBeGreaterThanOrEqual(3);
  }, 5000);
});
