/**
 * End-to-end proof that a viewed attachment reaches the model as a native tool-result part.
 *
 * The recall tool's unit tests cover the shape it returns; this file drives a real agent run so
 * the tool-result mapping (and the fact that it survives the memory-tool path) is exercised too.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import {
  MockLanguageModelV3,
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
} from '@internal/ai-v6/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { Memory } from '../index';

const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const remoteUrl = 'https://example.invalid/original.png';
const messageId = 'msg-view-attachment';
const threadId = 'thread-view-attachment';
const resourceId = 'resource-view-attachment';
const recallCallInput = JSON.stringify({ mode: 'messages', cursor: messageId, partIndex: 0, viewAttachment: true });

function createV5RecallThenAnswerModel(supportedUrls: Record<string, RegExp[]> = {}) {
  let streamCall = 0;
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

  return new MockLanguageModelV2({
    supportedUrls,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage,
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
        chunks.push({ type: 'tool-call', toolCallId: 'call-recall', toolName: 'recall', input: recallCallInput });
        chunks.push({ type: 'finish', finishReason: 'tool-calls', usage });
      } else {
        chunks.push({ type: 'text-start', id: 't1' });
        chunks.push({ type: 'text-delta', id: 't1', delta: 'Done' });
        chunks.push({ type: 'text-end', id: 't1' });
        chunks.push({ type: 'finish', finishReason: 'stop', usage });
      }

      return {
        stream: convertArrayToReadableStream(chunks),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  } as any);
}

function createV6RecallThenAnswerModel() {
  let streamCall = 0;
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  };

  return new MockLanguageModelV3({
    // The stored user message references the same remote URL; let the "provider" fetch it so the
    // agent doesn't try to download it before the first step.
    supportedUrls: { 'image/*': [/^https:\/\//] },
    doStream: async () => {
      streamCall++;
      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `r${streamCall}`, modelId: 'mock', timestamp: new Date(0) },
      ];

      if (streamCall === 1) {
        chunks.push({ type: 'tool-call', toolCallId: 'call-recall', toolName: 'recall', input: recallCallInput });
        chunks.push({ type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage });
      } else {
        chunks.push({ type: 'text-start', id: 't1' });
        chunks.push({ type: 'text-delta', id: 't1', delta: 'Done' });
        chunks.push({ type: 'text-end', id: 't1' });
        chunks.push({ type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage });
      }

      return { stream: convertArrayToReadableStreamV3(chunks) };
    },
  });
}

async function viewStoredAttachment(model: any, attachmentPart: Record<string, unknown>) {
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
        content: { format: 2, parts: [attachmentPart] },
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

  const lastPrompt = model.doStreamCalls.at(-1)?.prompt as any[];
  const toolResult = lastPrompt
    .flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))
    .find((part: any) => part.type === 'tool-result');

  expect(toolResult).toBeDefined();
  return toolResult.output.value as any[];
}

describe('recall viewAttachment through the agent loop', () => {
  it('hands an inline image to the model as a media tool-result part', async () => {
    const value = await viewStoredAttachment(createV5RecallThenAnswerModel(), {
      type: 'file',
      data: `data:image/png;base64,${base64Png}`,
      filename: 'inline.png',
    });

    expect(value).toEqual([
      { type: 'text', text: '[File: inline.png] image/png (inline data omitted)' },
      { type: 'media', data: base64Png, mediaType: 'image/png' },
    ]);
  });

  it('never puts a remote URL in the base64-only media field', async () => {
    const model = createV5RecallThenAnswerModel({ 'image/*': [/^https:\/\//] });

    const value = await viewStoredAttachment(model, {
      type: 'file',
      data: remoteUrl,
      mimeType: 'image/png',
      filename: 'original.png',
    });

    expect(value).toEqual([
      { type: 'text', text: `[File: original.png] image/png url: ${remoteUrl}` },
      { type: 'image-url', url: remoteUrl, mediaType: 'image/png' },
    ]);
  });

  it('hands a remote image to an AI SDK v6 model as an image-url part', async () => {
    const value = await viewStoredAttachment(createV6RecallThenAnswerModel(), {
      type: 'file',
      data: remoteUrl,
      mimeType: 'image/png',
      filename: 'original.png',
    });

    expect(value).toEqual([
      { type: 'text', text: `[File: original.png] image/png url: ${remoteUrl}` },
      { type: 'image-url', url: remoteUrl, mediaType: 'image/png' },
    ]);
  });
});
