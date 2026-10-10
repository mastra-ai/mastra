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
            { role: 'user', content: 'Where do I live?' },
            { role: 'assistant', content: 'You live in Kyoto.' },
          ],
        },
      },
    ]);
  });

  it('saves once after a tool loop, with the original user message', async () => {
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
            { role: 'user', content: 'Weather in Kyoto?' },
            { role: 'assistant', content: 'Sunny.' },
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
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello' },
          ],
        },
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
