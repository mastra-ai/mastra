import type { LanguageModelV3CallOptions } from '@ai-sdk/provider';
import { generateText, simulateReadableStream, stepCountIs, streamText, tool, wrapLanguageModel } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { platformMemoryMiddleware } from './ai-sdk';
import { PlatformMemoryClient } from './client';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const stop = { unified: 'stop' as const, raw: 'stop' };

function fakeClient(context: { system: string | null; messages: { role: 'user' | 'assistant'; content: string }[] }) {
  const saved: unknown[] = [];
  const client = {
    getContext: async () => ({ ...context, observedAt: null }),
    saveMessages: async (threadId: string, body: unknown) => {
      saved.push({ threadId, body });
      return { messages: [] };
    },
  } as unknown as PlatformMemoryClient;
  return { client, saved };
}

const recalled = {
  system: '<observations>Ada lives in Kyoto.</observations>',
  messages: [
    { role: 'user' as const, content: 'I like tea' },
    { role: 'assistant' as const, content: 'Noted.' },
  ],
};

describe('platformMemoryMiddleware', () => {
  it('prepends memory and saves the turn after generate', async () => {
    const { client, saved } = fakeClient(recalled);
    const calls: LanguageModelV3CallOptions[] = [];
    const model = new MockLanguageModelV3({
      doGenerate: async options => {
        calls.push(options);
        return { content: [{ type: 'text', text: 'You live in Kyoto.' }], finishReason: stop, usage, warnings: [] };
      },
    });

    const { text } = await generateText({
      model: wrapLanguageModel({
        model,
        middleware: platformMemoryMiddleware({ client, threadId: 't1', resourceId: 'u1' }),
      }),
      system: 'Be brief.',
      prompt: 'Where do I live?',
    });

    expect(text).toBe('You live in Kyoto.');
    expect(calls[0]!.prompt).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'system', content: recalled.system },
      { role: 'user', content: [{ type: 'text', text: 'I like tea' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Noted.' }] },
      { role: 'user', content: [{ type: 'text', text: 'Where do I live?' }] },
    ]);
    expect(saved).toEqual([
      {
        threadId: 't1',
        body: {
          resourceId: 'u1',
          messages: [
            { role: 'user', content: 'Where do I live?', parts: [{ type: 'text', text: 'Where do I live?' }] },
            { role: 'assistant', content: 'You live in Kyoto.', parts: [{ type: 'text', text: 'You live in Kyoto.' }] },
          ],
        },
      },
    ]);
  });

  it('saves once after a tool loop, with tool calls and their results', async () => {
    const { client, saved } = fakeClient({ system: null, messages: [] });
    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        step++ === 0
          ? {
              content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'weather', input: '{"city":"Kyoto"}' }],
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage,
              warnings: [],
            }
          : { content: [{ type: 'text', text: 'Sunny.' }], finishReason: stop, usage, warnings: [] },
    });

    await generateText({
      model: wrapLanguageModel({ model, middleware: platformMemoryMiddleware({ client, threadId: 't1' }) }),
      prompt: 'Weather in Kyoto?',
      tools: { weather: tool({ inputSchema: z.object({ city: z.string() }), execute: async () => 'sunny' }) },
      stopWhen: stepCountIs(3),
    });

    expect(saved).toEqual([
      {
        threadId: 't1',
        body: {
          resourceId: 't1',
          messages: [
            { role: 'user', content: 'Weather in Kyoto?', parts: [{ type: 'text', text: 'Weather in Kyoto?' }] },
            {
              role: 'assistant',
              content: 'Sunny.',
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolCallId: 'c1',
                    toolName: 'weather',
                    args: { city: 'Kyoto' },
                    result: 'sunny',
                  },
                },
                { type: 'text', text: 'Sunny.' },
              ],
            },
          ],
        },
      },
    ]);
  });

  it('saves the streamed reply after the stream finishes', async () => {
    const { client, saved } = fakeClient({ system: null, messages: [] });
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hel' },
            { type: 'text-delta', id: '1', delta: 'lo' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: stop, usage },
          ],
        }),
      }),
    });

    const result = streamText({
      model: wrapLanguageModel({ model, middleware: platformMemoryMiddleware({ client, threadId: 't1' }) }),
      prompt: 'Hi',
    });
    expect(await result.text).toBe('Hello');
    await result.consumeStream();

    expect(saved).toEqual([
      {
        threadId: 't1',
        body: {
          resourceId: 't1',
          messages: [
            { role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
            { role: 'assistant', content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
          ],
        },
      },
    ]);
  });

  it('saves streamed reasoning and user files as parts', async () => {
    const { client, saved } = fakeClient({ system: null, messages: [] });
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'reasoning-start', id: 'r' },
            { type: 'reasoning-delta', id: 'r', delta: 'It is a cat.' },
            { type: 'reasoning-end', id: 'r' },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'A cat.' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: stop, usage },
          ],
        }),
      }),
    });

    const result = streamText({
      model: wrapLanguageModel({ model, middleware: platformMemoryMiddleware({ client, threadId: 't1' }) }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'file', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' },
          ],
        },
      ],
    });
    await result.consumeStream();

    expect((saved[0] as { body: { messages: unknown[] } }).body.messages).toEqual([
      {
        role: 'user',
        content: 'What is this?',
        parts: [
          { type: 'text', text: 'What is this?' },
          { type: 'file', data: 'AQID', mimeType: 'image/png' },
        ],
      },
      {
        role: 'assistant',
        content: 'A cat.',
        parts: [
          { type: 'reasoning', reasoning: 'It is a cat.', details: [{ type: 'text', text: 'It is a cat.' }] },
          { type: 'text', text: 'A cat.' },
        ],
      },
    ]);
  });

  it('replays recalled tool calls with their results', async () => {
    const { client } = fakeClient({
      system: null,
      messages: [
        {
          role: 'assistant',
          content: 'Sunny.',
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'weather', args: { city: 'Kyoto' }, result: 'sunny' },
            },
            { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'c2', toolName: 'weather', args: {} } },
            { type: 'text', text: 'Sunny.' },
          ],
        },
      ],
    } as never);
    const calls: LanguageModelV3CallOptions[] = [];
    const model = new MockLanguageModelV3({
      doGenerate: async options => {
        calls.push(options);
        return { content: [{ type: 'text', text: 'ok' }], finishReason: stop, usage, warnings: [] };
      },
    });
    await generateText({
      model: wrapLanguageModel({ model, middleware: platformMemoryMiddleware({ client, threadId: 't1', readOnly: true }) }),
      prompt: 'And tomorrow?',
    });

    expect(calls[0]!.prompt.slice(0, 2)).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Sunny.' },
          { type: 'tool-call', toolCallId: 'c1', toolName: 'weather', input: { city: 'Kyoto' } },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'c1', toolName: 'weather', output: { type: 'json', value: 'sunny' } },
        ],
      },
    ]);
  });

  it('never writes in readOnly mode', async () => {
    const { client, saved } = fakeClient(recalled);
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({ content: [{ type: 'text', text: 'ok' }], finishReason: stop, usage, warnings: [] }),
    });
    await generateText({
      model: wrapLanguageModel({
        model,
        middleware: platformMemoryMiddleware({ client, threadId: 't1', readOnly: true }),
      }),
      prompt: 'Hi',
    });
    expect(saved).toEqual([]);
  });
});
