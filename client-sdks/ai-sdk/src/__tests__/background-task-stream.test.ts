import { ReadableStream } from 'node:stream/web';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { toAISdkStream, toAISdkV5Stream } from '../convert-streams';
import { convertFullStreamChunkToUIMessageStream, convertMastraChunkToAISDKv6 } from '../helpers';
import { WorkflowStreamToAISDKTransformer } from '../transformers';

async function collectChunks(stream: ReadableStream) {
  const chunks: any[] = [];

  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }

  return chunks;
}

describe('background task chunk conversion', () => {
  it('forwards background task lifecycle chunks through agent UI streams', async () => {
    const completedAt = new Date('2026-01-01T00:00:00.000Z');
    const startedAt = new Date('2026-01-01T00:00:01.000Z');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'background-task-started',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: {
            taskId: 'task-1',
            toolName: 'showSuggestions',
            toolCallId: 'call-1',
          },
        });
        controller.enqueue({
          type: 'background-task-running',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: {
            taskId: 'task-1',
            toolName: 'showSuggestions',
            toolCallId: 'call-1',
            runId: 'run-1',
            agentId: 'agent-1',
            startedAt,
            args: { topic: 'kyoto' },
          },
        });
        controller.enqueue({
          type: 'background-task-output',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: {
            taskId: 'task-1',
            toolName: 'showSuggestions',
            toolCallId: 'call-1',
            runId: 'run-1',
            agentId: 'agent-1',
            payload: {
              type: 'tool-output',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'showSuggestions',
                output: { suggestions: ['Add temples', 'Add markets'] },
              },
            },
          },
        });
        controller.enqueue({
          type: 'background-task-completed',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: {
            taskId: 'task-1',
            toolName: 'showSuggestions',
            toolCallId: 'call-1',
            runId: 'run-1',
            agentId: 'agent-1',
            result: { rendered: true },
            completedAt,
          },
        });
        controller.close();
      },
    });

    const chunks = await collectChunks(toAISdkV5Stream(stream as unknown as MastraModelOutput, { from: 'agent' }));

    expect(chunks.map(chunk => chunk.type)).toEqual([
      'data-background-task-started',
      'data-background-task-running',
      'data-background-task-output',
      'data-background-task-completed',
    ]);
    expect(chunks[0]).toMatchObject({
      id: 'task-1',
      data: {
        state: 'data-background-task-started',
        runId: 'run-1',
        taskId: 'task-1',
        toolName: 'showSuggestions',
        toolCallId: 'call-1',
      },
    });
    expect(chunks[1].data.args).toEqual({ topic: 'kyoto' });
    expect(chunks[1].data.startedAt).toBe(startedAt);
    expect(chunks[2].data.payload.payload.output).toEqual({ suggestions: ['Add temples', 'Add markets'] });
    expect(chunks[3].data.result).toEqual({ rendered: true });
    expect(chunks[3].data.completedAt).toBe(completedAt);
  });

  it('converts background task chunks for v6 streams', async () => {
    const chunk: ChunkType = {
      type: 'background-task-failed',
      runId: 'run-1',
      from: ChunkFrom.AGENT,
      payload: {
        taskId: 'task-1',
        toolName: 'showSuggestions',
        toolCallId: 'call-1',
        runId: 'run-1',
        agentId: 'agent-1',
        error: { message: 'failed' },
        completedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    };

    const part = convertMastraChunkToAISDKv6({
      chunk,
    }) as any;

    expect(part.type).toBe('data-background-task-failed');
    expect(part.id).toBe('task-1');
    expect(part.data).toMatchObject({
      state: 'data-background-task-failed',
      runId: 'run-1',
      taskId: 'task-1',
      toolName: 'showSuggestions',
      toolCallId: 'call-1',
      agentId: 'agent-1',
      error: { message: 'failed' },
    });
  });

  it('converts raw background task parts for UI message streams', () => {
    const part = convertFullStreamChunkToUIMessageStream({
      part: {
        type: 'background-task-started',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          taskId: 'task-1',
          toolName: 'showSuggestions',
          toolCallId: 'call-1',
        },
      } as any,
      onError: error => String(error),
    }) as any;

    expect(part).toEqual({
      type: 'data-background-task-started',
      id: 'task-1',
      data: {
        state: 'data-background-task-started',
        runId: 'run-1',
        taskId: 'task-1',
        toolName: 'showSuggestions',
        toolCallId: 'call-1',
      },
    });
  });

  it('forwards background task chunks from workflow step output', async () => {
    const stream = new ReadableStream<ChunkType>({
      start(controller) {
        controller.enqueue({
          type: 'workflow-start',
          runId: 'workflow-run-1',
          from: ChunkFrom.WORKFLOW,
          payload: { workflowId: 'workflow-1' },
        });
        controller.enqueue({
          type: 'workflow-step-start',
          runId: 'workflow-run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            id: 'agent-step',
            stepCallId: 'step-call-1',
            status: 'running',
          },
        });
        controller.enqueue({
          type: 'workflow-step-output',
          runId: 'workflow-run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            output: {
              type: 'background-task-completed',
              runId: 'agent-run-1',
              from: ChunkFrom.AGENT,
              payload: {
                taskId: 'task-1',
                toolName: 'showSuggestions',
                toolCallId: 'call-1',
                runId: 'agent-run-1',
                agentId: 'agent-1',
                result: { rendered: true },
                completedAt: new Date('2026-01-01T00:00:00.000Z'),
              },
            },
          },
        });
        controller.close();
      },
    });

    const chunks = await collectChunks(
      stream.pipeThrough(WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true })),
    );
    const backgroundTaskChunk = chunks.find(chunk => chunk.type === 'data-background-task-completed');

    expect(backgroundTaskChunk).toMatchObject({
      id: 'task-1',
      data: {
        state: 'data-background-task-completed',
        runId: 'agent-run-1',
        taskId: 'task-1',
        toolName: 'showSuggestions',
        toolCallId: 'call-1',
        agentId: 'agent-1',
        result: { rendered: true },
      },
    });
  });

  it('keeps background task chunks in v6 agent UI streams', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'background-task-progress',
          runId: 'run-1',
          from: ChunkFrom.AGENT,
          payload: {
            taskIds: ['task-1', 'task-2'],
            runningCount: 2,
            elapsedMs: 1000,
          },
        });
        controller.close();
      },
    });

    const chunks = await collectChunks(
      toAISdkStream(stream as unknown as MastraModelOutput, { from: 'agent', version: 'v6' }),
    );

    expect(chunks).toEqual([
      {
        type: 'data-background-task-progress',
        data: {
          state: 'data-background-task-progress',
          runId: 'run-1',
          taskIds: ['task-1', 'task-2'],
          runningCount: 2,
          elapsedMs: 1000,
        },
      },
    ]);
  });
});
