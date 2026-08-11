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

function createControlledStream(): {
  stream: ReadableStream<WorkflowStreamEvent>;
  controller: ReadableStreamDefaultController<WorkflowStreamEvent>;
} {
  let controller!: ReadableStreamDefaultController<WorkflowStreamEvent>;
  const stream = new ReadableStream<WorkflowStreamEvent>({
    start(c) {
      controller = c;
    },
  });
  return { stream, controller };
}

function markerChunk(id: string): WorkflowStreamEvent {
  return {
    type: 'workflow-step-output',
    runId: 'run-1',
    from: ChunkFrom.WORKFLOW,
    payload: {
      id,
      stepId: id,
      output: { type: 'marker' },
    },
  } as WorkflowStreamEvent;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

async function drain(
  reader: ReadableStreamDefaultReader<WorkflowStreamEvent>,
  timeoutMs = 1000,
): Promise<WorkflowStreamEvent[]> {
  const chunks: WorkflowStreamEvent[] = [];
  // Race each read against a timeout so a regression (a hung reader) fails the
  // test instead of hanging the whole suite.
  while (true) {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('reader hung (timed out)')), timeoutMs)),
    ]);
    if (result.done) break;
    chunks.push(result.value);
  }
  return chunks;
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
  it('includes the canonical workflow result in the terminal event', async () => {
    let controller: ReadableStreamDefaultController<WorkflowStreamEvent>;
    const output = new WorkflowRunOutput({
      runId: 'run-1',
      workflowId: 'workflow-1',
      stream: new ReadableStream<WorkflowStreamEvent>({
        start(streamController) {
          controller = streamController;
        },
      }),
    });
    const chunksPromise = (async () => {
      const chunks: WorkflowStreamEvent[] = [];
      for await (const chunk of output.fullStream) chunks.push(chunk);
      return chunks;
    })();

    output.updateResults({ status: 'success', result: { total: 5 } } as any);
    controller!.close();

    const chunks = await chunksPromise;
    expect(chunks.at(-1)).toMatchObject({
      type: 'workflow-finish',
      payload: {
        workflowStatus: 'success',
        finalWorkflowResult: { total: 5 },
      },
    });
  });

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

  it('cancelling one fullStream consumer does not detach the others', async () => {
    const { stream, controller } = createControlledStream();
    const output = new WorkflowRunOutput({ runId: 'run-1', workflowId: 'workflow-1', stream });

    const readerA = output.fullStream.getReader();
    const readerB = output.fullStream.getReader();

    // Let the pipeline emit workflow-start and a first chunk to both consumers.
    controller.enqueue(markerChunk('a'));
    await flush();

    // Consumer A opts out — this must not affect consumer B.
    await readerA.cancel();

    // More work happens after A leaves.
    controller.enqueue(markerChunk('b'));
    controller.close();

    // B must still receive the post-cancel chunk and then close (not hang).
    const received = await drain(readerB);
    const ids = received.map(c => (c.payload as { id?: string }).id).filter(Boolean);

    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(received.some(c => c.type === 'workflow-finish')).toBe(true);
  });

  it('rejects result/usage and closes consumers when the stream pipeline errors', async () => {
    const { stream, controller } = createControlledStream();
    const output = new WorkflowRunOutput({ runId: 'run-1', workflowId: 'workflow-1', stream });

    const reader = output.fullStream.getReader();
    const resultPromise = output.result;
    const usagePromise = output.usage;

    // The source stream fails mid-run (e.g. a provider/transport error).
    controller.error(new Error('boom'));

    // result/usage reject instead of hanging forever.
    await expect(resultPromise).rejects.toThrow('boom');
    await expect(usagePromise).rejects.toThrow('boom');

    // The consumer receives a terminal failed finish and closes.
    const chunks = await drain(reader);
    const finish = chunks.find(c => c.type === 'workflow-finish');
    expect(finish).toBeDefined();
    expect((finish?.payload as { workflowStatus?: string }).workflowStatus).toBe('failed');
  });

  it('rejects result/usage and closes consumers when the pipeline errors after resume()', async () => {
    // First leg of the run: stream ends cleanly (e.g. the run suspends).
    const first = createControlledStream();
    const output = new WorkflowRunOutput({ runId: 'run-1', workflowId: 'workflow-1', stream: first.stream });
    first.controller.close();
    await drain(output.fullStream.getReader());

    // The run is resumed with a fresh stream, which then fails mid-run.
    const second = createControlledStream();
    output.resume(second.stream);

    const reader = output.fullStream.getReader();
    const resultPromise = output.result;
    const usagePromise = output.usage;

    second.controller.error(new Error('resume boom'));

    // The re-armed result/usage promises reject instead of hanging forever.
    await expect(resultPromise).rejects.toThrow('resume boom');
    await expect(usagePromise).rejects.toThrow('resume boom');

    // The post-resume consumer receives a terminal failed finish and closes.
    const chunks = await drain(reader);
    const finish = chunks.filter(c => c.type === 'workflow-finish').at(-1);
    expect(finish).toBeDefined();
    expect((finish?.payload as { workflowStatus?: string }).workflowStatus).toBe('failed');
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
