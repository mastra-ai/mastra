/**
 * Regression for #26795: a streamed document source (e.g. an Anthropic PDF
 * citation) must be stored in memory as a `source-document` part, not as a
 * url source with an empty url.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { MessageList } from '../message-list';

const threadId = 'source-document-thread';
const resourceId = 'source-document-resource';

function createModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
        { type: 'source', sourceType: 'url', id: 'url-1', url: 'https://example.com/report', title: 'Report page' },
        {
          type: 'source',
          sourceType: 'document',
          id: 'doc-1',
          mediaType: 'application/pdf',
          title: 'Q3 report',
          filename: 'q3.pdf',
        },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'Revenue grew 12%.' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ] as any[]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  }) as unknown as LanguageModelV2;
}

describe('Agent memory: streamed document sources', () => {
  it('stores document sources as source-document parts and returns them after recall', async () => {
    const memory = new MockMemory({ storage: new InMemoryStore() });
    const agent = new Agent({
      id: 'source-document-agent',
      name: 'source-document-agent',
      instructions: 'Cite your sources.',
      model: createModel(),
      memory,
    });

    const result = await agent.stream('What happened in Q3?', { memory: { thread: threadId, resource: resourceId } });
    await result.consumeStream();

    const { messages } = await memory.recall({ threadId, resourceId });
    const assistant = messages.find(message => message.role === 'assistant');
    const storedParts = assistant!.content.parts;

    expect(storedParts).toContainEqual(
      expect.objectContaining({
        type: 'source-document',
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Q3 report',
        filename: 'q3.pdf',
      }),
    );
    expect(storedParts).toContainEqual(
      expect.objectContaining({
        type: 'source',
        source: expect.objectContaining({ sourceType: 'url', id: 'url-1', url: 'https://example.com/report' }),
      }),
    );
    expect(storedParts.filter(part => part.type === 'source' && !part.source.url)).toEqual([]);

    const [uiMessage] = new MessageList().add(assistant!, 'memory').get.all.aiV5.ui();
    expect(uiMessage!.parts).toContainEqual(
      expect.objectContaining({ type: 'source-document', sourceId: 'doc-1', filename: 'q3.pdf' }),
    );
  });
});
