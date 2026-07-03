import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { MessageList } from '../message-list';

/**
 * Baseline repro tests for message payload duplication at rest (storage dedupe).
 *
 * Root cause 1: when a tool defines `toModelOutput()`, the mapped output is persisted at
 * `providerMetadata.mastra.modelOutput` alongside the raw `toolInvocation.result`. For
 * screenshot-style tools the same large payload string is stored twice in one part.
 *
 * Root cause 2: `AIV5Adapter.toDB` derives `experimental_attachments` from `file` parts and
 * persists both, so every attachment's bytes are stored twice in the same row.
 *
 * These tests measure the at-rest shape (raw store rows) and the in-process shape (what
 * consumers see after read), pinning that dedupe is invisible to consumers.
 */

const BIG_PAYLOAD = `iVBORw0KGgoAAAANSUhEUg${'A'.repeat(4096)}==`;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('message payload dedupe at rest', () => {
  it('stores a large toModelOutput payload once when it is embedded in the raw tool result', async () => {
    let doStreamCallCount = 0;
    const toolCallModel = new MockLanguageModelV2({
      doStream: async () => {
        doStreamCallCount++;
        if (doStreamCallCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-screenshot-1',
                toolName: 'screenshot-tool',
                input: '{}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'I looked at the screenshot' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    // Screenshot-shaped tool: raw result embeds the big base64 string, and toModelOutput
    // wraps the exact same string in a model-facing shape (same bytes, different wrapper).
    const rawResult = {
      content: [{ type: 'image', data: BIG_PAYLOAD, mimeType: 'image/png' }],
    };
    const expectedModelOutput = {
      type: 'content',
      value: [{ type: 'media', data: BIG_PAYLOAD, mediaType: 'image/png' }],
    };

    const screenshotTool = createTool({
      id: 'screenshot-tool',
      description: 'Takes a screenshot',
      inputSchema: z.object({}),
      execute: async () => rawResult,
      toModelOutput: () => expectedModelOutput as any,
    });

    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'payload-dedupe-agent',
      name: 'Payload Dedupe Test',
      instructions: 'Take a screenshot, then describe it.',
      model: toolCallModel,
      memory: mockMemory,
      tools: { 'screenshot-tool': screenshotTool },
    });

    const threadId = 'thread-payload-dedupe';
    const resourceId = 'resource-payload-dedupe';

    const result = await agent.stream('take a screenshot', {
      memory: { thread: threadId, resource: resourceId },
    });
    await result.consumeStream();

    // --- At-rest shape: read raw rows straight from the store (below Memory) ---
    const memoryStore = await mockMemory.storage.getStore('memory');
    const { messages: rawRows } = await memoryStore!.listMessages({ threadId, perPage: false });
    const atRest = JSON.stringify(rawRows);

    // The raw result must be stored in full.
    expect(atRest).toContain(BIG_PAYLOAD);
    // The payload must be stored exactly once — modelOutput must reference it, not copy it.
    expect(countOccurrences(atRest, BIG_PAYLOAD)).toBe(1);

    // --- In-process shape: reads through Memory must see the exact original shapes ---
    const recalled = await mockMemory.recall({ threadId, resourceId });
    const toolResultPart = recalled.messages
      .flatMap(message => message.content.parts ?? [])
      .find(
        part =>
          part.type === 'tool-invocation' &&
          (part as any).toolInvocation?.toolCallId === 'call-screenshot-1' &&
          (part as any).toolInvocation?.state === 'result',
      ) as any;

    expect(toolResultPart).toBeDefined();
    expect(toolResultPart.toolInvocation.result).toEqual(rawResult);
    expect(toolResultPart.providerMetadata?.mastra?.modelOutput).toEqual(expectedModelOutput);
  });

  it('rehydrates stored payload refs when messages re-enter a MessageList from memory', async () => {
    // Simulates any consumer that reads rows straight from a store (bypassing Memory)
    // and feeds them into a MessageList: markers must be resolved back to full strings.
    const dbMessage = {
      id: 'msg-marker-1',
      role: 'assistant' as const,
      createdAt: new Date(),
      threadId: 'thread-marker',
      resourceId: 'resource-marker',
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'screenshot-tool',
              args: {},
              state: 'result' as const,
              result: { content: [{ type: 'image', data: BIG_PAYLOAD, mimeType: 'image/png' }] },
            },
            providerMetadata: {
              mastra: {
                modelOutput: {
                  type: 'content',
                  value: [
                    {
                      type: 'media',
                      data: { $mastra_tool_result_ref: ['content', 0, 'data'] },
                      mediaType: 'image/png',
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    };

    const list = new MessageList({ threadId: 'thread-marker', resourceId: 'resource-marker' });
    list.add(dbMessage as any, 'memory');

    const [assistant] = list.get.all.db();
    const part = (assistant?.content.parts ?? []).find(p => p.type === 'tool-invocation') as any;
    expect(part).toBeDefined();
    expect(part.providerMetadata?.mastra?.modelOutput).toEqual({
      type: 'content',
      value: [{ type: 'media', data: BIG_PAYLOAD, mediaType: 'image/png' }],
    });
  });
});

describe('attachment payload dedupe at rest', () => {
  it('stores file attachment bytes once (no experimental_attachments duplicate of file parts)', async () => {
    const dataUri = `data:image/png;base64,${BIG_PAYLOAD}`;

    // AIV5 UI message with a file part → AIV5Adapter.toDB
    const list = new MessageList({ threadId: 'thread-attach', resourceId: 'resource-attach' });
    list.add(
      {
        id: 'attach-msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'file', url: dataUri, mediaType: 'image/png' },
        ],
      } as any,
      'user',
    );

    const dbMessages = list.get.all.db();
    const atRest = JSON.stringify(dbMessages);

    expect(atRest).toContain(BIG_PAYLOAD);
    expect(countOccurrences(atRest, BIG_PAYLOAD)).toBe(1);

    // The file part must retain the data.
    const fileParts = dbMessages.flatMap(m => m.content.parts ?? []).filter(p => p.type === 'file') as any[];
    expect(fileParts).toHaveLength(1);
    expect(fileParts[0].data).toBe(dataUri);
  });

  it('still persists experimental_attachments for true V4 input without file parts', async () => {
    const dataUri = `data:image/png;base64,${BIG_PAYLOAD}`;

    const list = new MessageList({ threadId: 'thread-attach-v4', resourceId: 'resource-attach-v4' });
    list.add(
      {
        id: 'attach-msg-v4',
        role: 'user',
        content: 'What is in this image?',
        parts: [{ type: 'text', text: 'What is in this image?' }],
        experimental_attachments: [{ url: dataUri, contentType: 'image/png', name: 'img.png' }],
      } as any,
      'user',
    );

    const dbMessages = list.get.all.db();
    const atRest = JSON.stringify(dbMessages);

    // The attachment data must survive, stored exactly once.
    expect(atRest).toContain(BIG_PAYLOAD);
    expect(countOccurrences(atRest, BIG_PAYLOAD)).toBe(1);
  });
});
