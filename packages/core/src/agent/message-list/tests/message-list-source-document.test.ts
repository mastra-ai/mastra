import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../../index';
import { MessageList } from '../../index';

const assistantWithSources = (): MastraDBMessage => ({
  id: 'assistant-1',
  role: 'assistant',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: {
    format: 2,
    parts: [
      { type: 'text', text: 'Revenue grew 12%.' },
      {
        type: 'source',
        source: { sourceType: 'url', id: 'url-1', url: 'https://example.com/report', title: 'Report page' },
      },
      {
        type: 'source-document',
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Q3 report',
        filename: 'q3.pdf',
      },
    ],
  },
});

describe('MessageList source-document parts', () => {
  it('returns stored document sources as source-document parts in AI SDK v5 UI messages', () => {
    const [message] = new MessageList().add(assistantWithSources(), 'memory').get.all.aiV5.ui();

    expect(message!.parts).toContainEqual(
      expect.objectContaining({
        type: 'source-url',
        sourceId: 'url-1',
        url: 'https://example.com/report',
        title: 'Report page',
      }),
    );
    expect(message!.parts).toContainEqual(
      expect.objectContaining({
        type: 'source-document',
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Q3 report',
        filename: 'q3.pdf',
      }),
    );
  });

  it('returns exactly one source-document part in AI SDK v6 UI messages', () => {
    const [message] = new MessageList().add(assistantWithSources(), 'memory').get.all.aiV6.ui();

    const documents = message!.parts.filter(part => part.type === 'source-document');
    expect(documents).toEqual([
      expect.objectContaining({
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Q3 report',
        filename: 'q3.pdf',
      }),
    ]);
  });

  it('round-trips AI SDK v5 UI source parts without losing sourceId, title or document metadata', () => {
    const [uiMessage] = new MessageList().add(assistantWithSources(), 'memory').get.all.aiV5.ui();

    const [dbMessage] = new MessageList().add(uiMessage!, 'memory').get.all.db();

    expect(dbMessage!.content.parts).toContainEqual(
      expect.objectContaining({
        type: 'source',
        source: expect.objectContaining({
          sourceType: 'url',
          id: 'url-1',
          url: 'https://example.com/report',
          title: 'Report page',
        }),
      }),
    );
    expect(dbMessage!.content.parts).toContainEqual(
      expect.objectContaining({
        type: 'source-document',
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Q3 report',
        filename: 'q3.pdf',
      }),
    );
  });

  it('keeps source parts out of model messages', () => {
    const list = new MessageList().add(assistantWithSources(), 'memory');

    const modelMessages = list.get.all.aiV5.model();

    expect(modelMessages).toHaveLength(1);
    expect(JSON.stringify(modelMessages)).not.toContain('q3.pdf');
    expect(modelMessages[0]!.content).toEqual([expect.objectContaining({ type: 'text', text: 'Revenue grew 12%.' })]);
  });
});
