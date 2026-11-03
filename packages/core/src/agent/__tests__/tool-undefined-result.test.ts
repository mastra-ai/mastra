/**
 * #27370: a server tool whose `execute` returns `undefined` must behave like one
 * that returns a value. Previously the loop read the missing result as a call
 * still waiting on the client, so it stopped after the tool ran, left the
 * stored call in `call` state, and dropped it from the next turn's prompt.
 */
import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const threadId = 'undefined-result-thread';
const resourceId = 'undefined-result-resource';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createModel(prompts: LanguageModelV2Prompt[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      prompts.push(prompt);
      const parts =
        prompts.length === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'notify', input: '{"message":"hi"}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Sent.' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV2;
}

describe('server tool returning undefined (#27370)', () => {
  it('continues the loop, stores the result and keeps the call in the next prompt', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
    const prompts: LanguageModelV2Prompt[] = [];
    const execute = vi.fn(async () => undefined);
    const agent = new Agent({
      id: 'undefined-result-agent',
      name: 'undefined-result-agent',
      instructions: 'Notify, then confirm.',
      model: createModel(prompts),
      memory,
      tools: {
        notify: createTool({
          id: 'notify',
          description: 'Sends a notification',
          inputSchema: z.object({ message: z.string() }),
          execute,
        }),
      },
    });
    const memoryOptions = { memory: { thread: threadId, resource: resourceId } };

    const stream = await agent.stream('Notify me.', memoryOptions);
    const chunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) chunkTypes.push(chunk.type);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(prompts).toHaveLength(2);
    expect(await stream.finishReason).toBe('stop');
    expect(await stream.text).toBe('Sent.');
    expect(chunkTypes).toContain('tool-result');

    const memoryStore = (await storage.getStore('memory'))!;
    const { messages } = await memoryStore.listMessages({ threadId });
    const toolInvocations = messages.flatMap(message =>
      message.content.parts.flatMap(part => (part.type === 'tool-invocation' ? [part.toolInvocation] : [])),
    );
    expect(toolInvocations.map(invocation => invocation.state)).toEqual(['result']);
    expect(toolInvocations[0]).toHaveProperty('result', null);

    await (await agent.stream('Again.', memoryOptions)).consumeStream();

    const nextPrompt = prompts[2]!;
    const contentTypes = nextPrompt.flatMap(message =>
      Array.isArray(message.content) ? message.content.map(part => `${message.role}:${part.type}`) : [],
    );
    expect(contentTypes).toContain('assistant:tool-call');
    expect(contentTypes).toContain('tool:tool-result');
    const promptedResult = nextPrompt
      .flatMap(message => (message.role === 'tool' ? message.content : []))
      .find(part => part.type === 'tool-result' && part.toolCallId === 'call-1');
    expect(promptedResult).toMatchObject({ output: { type: 'json', value: null } });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
