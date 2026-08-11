/**
 * Regression test: thread title generation via chatRoute (handleChatStream, AI SDK v6).
 *
 * The title generation path feeds AIV4 UI messages, which carry the same text in
 * both `content` (string) and a text `part`. formatMessagesForTitle used to emit
 * both, so the title model received every conversation message twice:
 *
 *   User: hi
 *   User: hi
 *   Assistant: Hello! How can I help?
 *   Assistant: Hello! How can I help?
 *
 * The duplicated transcript confused small title models into replying to the
 * conversation instead of producing a title. This test captures the exact input
 * the title model receives and asserts each message appears exactly once.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { describe, expect, it } from 'vitest';

import { handleChatStream } from '../chat-route';

function createMainModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello! How can I help?' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ] as any),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });
}

describe('chatRoute title generation (v6)', () => {
  it('sends each conversation message to the title model exactly once (no content/parts duplication)', async () => {
    let capturedTitlePrompt: any[] | undefined;

    const titleModel = new MockLanguageModelV2({
      doGenerate: async options => {
        capturedTitlePrompt = options.prompt as any[];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Greeting',
          content: [{ type: 'text', text: 'Greeting' }],
          warnings: [],
        };
      },
    });

    const memory = new MockMemory({
      options: {
        generateTitle: {
          model: titleModel,
        },
        lastMessages: 10000,
      },
    });

    const agent = new Agent({
      id: 'title-agent',
      name: 'Title Agent',
      instructions: 'You are a helpful assistant.',
      model: createMainModel(),
      memory,
    });
    const mastra = new Mastra({ agents: { [agent.id]: agent } });

    // Exactly what assistant-ui sends through chatRoute (AI SDK v6 UIMessage)
    const stream = await handleChatStream({
      mastra,
      agentId: 'title-agent',
      version: 'v6',
      params: {
        messages: [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        memory: { thread: 'chat-route-title-thread', resource: 'chat-route-title-user' },
      },
    });

    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Title generation is fire-and-forget after the stream finishes
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(capturedTitlePrompt).toBeDefined();
    const userMsg = capturedTitlePrompt!.find((msg: any) => msg.role === 'user');
    const textParts = (userMsg?.content ?? []).filter((p: any) => p.type === 'text');
    const allText = textParts.map((p: any) => p.text).join('\n');

    // Each conversation message must appear exactly once
    expect(allText).toBe('User: hi\nAssistant: Hello! How can I help?');
    // No JSON artifacts
    expect(allText).not.toContain('{');
    expect(allText).not.toContain('"type"');
    expect(allText).not.toContain('providerOptions');
  });
});
