import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MockMemory } from '../../memory/mock';
import type { InputProcessor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { AgentSignalInput } from '../signals';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('signal sent while a tool is executing', () => {
  it('keeps the running tool call, its data parts, and its result in history and in the next prompt', async () => {
    const prompts: unknown[] = [];
    const toolStarted = deferred();
    const releaseTool = deferred();

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        if (prompts.length === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'tool-call', toolCallId: 'running-call', toolName: 'slowTool', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'done' },
            { type: 'text-end', id: 'text-2' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });

    const slowTool = createTool({
      id: 'slowTool',
      description: 'blocks until released',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        toolStarted.resolve();
        await releaseTool.promise;
        await context?.writer?.custom({ type: 'data-tool-exit', data: { toolCallId: 'running-call' } });
        return { ok: 'tool-finished' };
      },
    });

    // A processor that keeps the step's sendSignal and fires it later from
    // background work, the way asynchronous reminders are delivered.
    let heldSendSignal: ((signal: AgentSignalInput) => Promise<unknown>) | undefined;
    const reminderProcessor: InputProcessor = {
      id: 'background-reminder',
      processInputStep: async ({ sendSignal, stepNumber }) => {
        if (stepNumber === 0) heldSendSignal = sendSignal;
      },
    };

    const memory = new MockMemory();
    const agent = new Agent({
      id: 'signal-during-tool-agent',
      name: 'Signal During Tool Agent',
      instructions: 'Test',
      model,
      memory,
      tools: { slowTool },
      inputProcessors: [reminderProcessor],
    });

    const thread = { thread: 'signal-tool-thread', resource: 'signal-tool-user' };
    const stream = await agent.stream('Hello', { memory: thread });
    const consumed = stream.consumeStream();

    await toolStarted.promise;
    await heldSendSignal!({ type: 'reactive', contents: 'Reminder arrived while the tool ran' });
    releaseTool.resolve();
    await consumed;

    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[1])).toContain('Reminder arrived while the tool ran');
    const promptParts = (prompts[1] as Array<{ role: string; content: unknown }>).flatMap(message =>
      Array.isArray(message.content)
        ? (message.content as Array<Record<string, unknown>>).map(part => ({ role: message.role, ...part }))
        : [],
    );
    expect(promptParts).toContainEqual(
      expect.objectContaining({
        role: 'assistant',
        type: 'tool-call',
        toolCallId: 'running-call',
        toolName: 'slowTool',
      }),
    );
    expect(promptParts).toContainEqual(
      expect.objectContaining({
        role: 'tool',
        type: 'tool-result',
        toolCallId: 'running-call',
        output: expect.objectContaining({ value: { ok: 'tool-finished' } }),
      }),
    );

    const { messages } = await memory.recall({ threadId: thread.thread, resourceId: thread.resource });
    const owner = messages.find(message =>
      message.content.parts.some(
        part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'running-call',
      ),
    );
    expect(owner).toBeDefined();
    expect(owner!.content.parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({
          toolCallId: 'running-call',
          state: 'result',
          result: { ok: 'tool-finished' },
        }),
      }),
    );
    expect(owner!.content.parts).toContainEqual(
      expect.objectContaining({ type: 'data-tool-exit', data: { toolCallId: 'running-call' } }),
    );
  });
});
