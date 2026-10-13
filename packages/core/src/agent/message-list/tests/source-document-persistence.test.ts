import type { UIMessage as AIV5UIMessage } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { AIV5Adapter } from '../adapters';
import type { MastraDBMessage } from '../index';

// Regression tests for #26795: document sources (e.g. Anthropic PDF citations)
// were saved as empty-url source-url parts and dropped by the v5 UI adapter.

const dbMessageWith = (parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
  id: 'msg-1',
  role: 'assistant',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts },
});

describe('source-document persistence (AIV5Adapter)', () => {
  it('toUIMessage emits a stored source-document part instead of dropping it', () => {
    const uiMsg = AIV5Adapter.toUIMessage(
      dbMessageWith([
        {
          type: 'source-document',
          sourceId: 'src-2',
          mediaType: 'application/pdf',
          title: 'Q3 Report',
          filename: 'q3.pdf',
        },
      ]),
    );

    expect(uiMsg.parts).toContainEqual(
      expect.objectContaining({
        type: 'source-document',
        sourceId: 'src-2',
        mediaType: 'application/pdf',
        title: 'Q3 Report',
        filename: 'q3.pdf',
      }),
    );
  });

  it('fromUIMessage stores a source-document UI part as a source-document DB part', () => {
    const dbMsg = AIV5Adapter.fromUIMessage({
      id: 'msg-1',
      role: 'assistant',
      parts: [
        {
          type: 'source-document',
          sourceId: 'src-2',
          mediaType: 'application/pdf',
          title: 'Q3 Report',
          filename: 'q3.pdf',
        },
      ],
    } as AIV5UIMessage);

    expect(dbMsg.content.parts).toContainEqual(
      expect.objectContaining({
        type: 'source-document',
        sourceId: 'src-2',
        mediaType: 'application/pdf',
        title: 'Q3 Report',
        filename: 'q3.pdf',
      }),
    );
  });

  it('fromUIMessage keeps sourceId and title on a source-url part', () => {
    const dbMsg = AIV5Adapter.fromUIMessage({
      id: 'msg-1',
      role: 'assistant',
      parts: [
        {
          type: 'source-url',
          sourceId: 'src-1',
          url: 'https://example.com/a',
          title: 'Example A',
        },
      ],
    } as AIV5UIMessage);

    expect(dbMsg.content.parts).toContainEqual(
      expect.objectContaining({
        type: 'source',
        source: expect.objectContaining({
          sourceType: 'url',
          id: 'src-1',
          url: 'https://example.com/a',
          title: 'Example A',
        }),
      }),
    );
  });

  it('round-trips a document source through UI and back without loss', () => {
    const original = dbMessageWith([
      {
        type: 'source-document',
        sourceId: 'src-2',
        mediaType: 'application/pdf',
        title: 'Q3 Report',
        filename: 'q3.pdf',
      },
    ]);

    const roundTripped = AIV5Adapter.fromUIMessage(AIV5Adapter.toUIMessage(original));

    expect(roundTripped.content.parts).toContainEqual(
      expect.objectContaining({
        type: 'source-document',
        sourceId: 'src-2',
        mediaType: 'application/pdf',
        title: 'Q3 Report',
        filename: 'q3.pdf',
      }),
    );
  });
});
