import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';

import { TaskStateProcessor } from './task-state-processor';
import { taskCheckTool, taskCompleteTool, taskUpdateTool, taskWriteTool } from './task-tools';

/**
 * End-to-end repro: write tasks in one step, then update one in the next step,
 * within a single agent run. Mirrors the failing MC Scenario 1.
 */
function stepParts(call: number) {
  if (call === 1) {
    return [
      {
        type: 'tool-call' as const,
        id: 'tc-1',
        toolCallId: 'call-write',
        toolName: 'task_write',
        args: JSON.stringify({
          tasks: [
            { content: 'Alpha', status: 'pending', activeForm: 'Alpha' },
            { content: 'Beta', status: 'pending', activeForm: 'Beta' },
          ],
        }),
      },
    ];
  }
  if (call === 2) {
    return [
      {
        type: 'tool-call' as const,
        id: 'tc-2',
        toolCallId: 'call-update',
        toolName: 'task_update',
        args: JSON.stringify({ id: 'task_alpha', status: 'in_progress' }),
      },
    ];
  }
  return [{ type: 'text' as const, text: 'Done' }];
}

function multiStepTaskModel() {
  let streamCall = 0;
  let genCall = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      genCall++;
      const parts = stepParts(genCall);
      const isToolStep = genCall < 3;
      return {
        content: parts as any,
        finishReason: isToolStep ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
    doStream: async () => {
      streamCall++;
      const parts = stepParts(streamCall);
      const isToolStep = streamCall < 3;
      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `r${streamCall}`, modelId: 'mock', timestamp: new Date(0) },
      ];
      if (isToolStep) {
        const part = parts[0] as { toolCallId: string; toolName: string; args: string };
        chunks.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.args,
        });
        chunks.push({
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
      } else {
        chunks.push({ type: 'text-start', id: 't1' });
        chunks.push({ type: 'text-delta', id: 't1', delta: 'Done' });
        chunks.push({ type: 'text-end', id: 't1' });
        chunks.push({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
      }
      return {
        stream: convertArrayToReadableStream(chunks),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('task tools e2e (multi-step within one run)', () => {
  it('task_update finds a task written in a prior step of the same run', async () => {
    const agent = new Agent({
      id: 'task-agent',
      name: 'task-agent',
      instructions: 'You manage tasks.',
      model: multiStepTaskModel(),
      memory: new MockMemory(),
      tools: {
        task_write: taskWriteTool,
        task_update: taskUpdateTool,
        task_complete: taskCompleteTool,
        task_check: taskCheckTool,
      },
      inputProcessors: [new TaskStateProcessor()],
    });

    // Register the agent with a Mastra that has storage so the task tools and
    // processor can resolve the thread-scoped `threadState` store.
    new Mastra({ agents: { 'task-agent': agent }, storage: new InMemoryStore(), logger: false });

    const stream = await agent.stream('Create Alpha and Beta, then mark Alpha in progress.', {
      memory: { resource: 'resource-1', thread: { id: 'thread-1' } },
      maxSteps: 5,
    });

    const toolResults: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') toolResults.push(chunk);
    }

    const byName = (name: string) => toolResults.find(r => r.payload?.toolName === name);
    const resultOf = (r: any) => r?.payload?.result;

    const writeResult = byName('task_write');
    const updateResult = byName('task_update');

    expect(resultOf(writeResult)?.isError).toBe(false);
    expect(updateResult).toBeDefined();
    expect(resultOf(updateResult)?.isError).toBe(false);
    expect(resultOf(updateResult)?.tasks?.find((t: any) => t.id === 'task_alpha')?.status).toBe('in_progress');
  });
});
