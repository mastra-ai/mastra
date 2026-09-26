/**
 * End-to-end proof that a viewed attachment reaches the model as a native media part.
 *
 * The recall tool's unit tests cover the shape it returns; this file drives a real agent run so
 * the tool-result mapping (and the fact that it survives the memory-tool path) is exercised too.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { Memory } from '../index';

const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const messageId = 'msg-view-attachment';
const threadId = 'thread-view-attachment';
const resourceId = 'resource-view-attachment';

function createRecallThenAnswerModel() {
  let streamCall = 0;

  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
      content: [{ type: 'text', text: 'Done' }],
    }),
    doStream: async () => {
      streamCall++;
      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `r${streamCall}`, modelId: 'mock', timestamp: new Date(0) },
      ];

      if (streamCall === 1) {
        chunks.push({
          type: 'tool-call',
          toolCallId: 'call-recall',
          toolName: 'recall',
          input: JSON.stringify({ mode: 'messages', cursor: messageId, partIndex: 0, viewAttachment: true }),
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
  } as any);

  return model;
}

describe('recall viewAttachment through the agent loop', () => {
  it('hands the stored image to the model as a media tool-result part', async () => {
    const model = createRecallThenAnswerModel();
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { model, scope: 'thread', retrieval: true } } as any,
    });

    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Attachment thread',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      },
    });
    await memory.saveMessages({
      messages: [
        {
          id: messageId,
          threadId,
          resourceId,
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'file', data: `data:image/png;base64,${base64Png}`, filename: 'inline.png' }],
          },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ] as any,
    });

    const agent = new Agent({
      id: 'attachment-agent',
      name: 'attachment-agent',
      instructions: 'Answer.',
      model,
      memory,
    });

    const output = await agent.stream('look at the attachment', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3,
    });
    await output.consumeStream();

    const lastPrompt = (model as any).doStreamCalls.at(-1)?.prompt as any[];
    const toolResult = lastPrompt
      .flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))
      .find((part: any) => part.type === 'tool-result');

    expect(toolResult).toBeDefined();
    const value = toolResult.output.value as any[];
    expect(value[0]).toEqual({ type: 'text', text: '[File: inline.png] image/png (inline data omitted)' });

    const media = value.find((part: any) => part.type === 'media' || part.type === 'image-data');
    expect(media).toMatchObject({ data: base64Png, mediaType: 'image/png' });
  });
});
