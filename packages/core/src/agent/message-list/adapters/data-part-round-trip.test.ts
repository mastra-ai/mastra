import { describe, expect, it } from 'vitest';

import { dataPartToDBMessage } from '../../signals';
import type { MastraDBMessage } from '../state/types';
import { AIV4Adapter } from './AIV4Adapter';
import { AIV5Adapter } from './AIV5Adapter';
import { AIV6Adapter } from './AIV6Adapter';

describe('data part persistence round-trip', () => {
  const sampleDataPart = {
    type: 'data-om-observation' as const,
    data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
  };

  const dbMessage = dataPartToDBMessage(sampleDataPart, {
    threadId: 'thread-1',
    resourceId: 'user-1',
  });

  it('dataPartToDBMessage produces an assistant message with the data part in parts', () => {
    expect(dbMessage.role).toBe('assistant');
    expect(dbMessage.content.format).toBe(2);
    expect(dbMessage.content.parts).toHaveLength(1);
    expect(dbMessage.content.parts[0]).toEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
    expect(dbMessage.content.content).toBe('');
    expect(dbMessage.content.metadata).toBeUndefined();
  });

  it('AIV5Adapter round-trips data parts to exact { type, data } shape', () => {
    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);
    expect(uiMessage.role).toBe('assistant');
    expect(uiMessage.parts).toContainEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('AIV4Adapter round-trips data parts to exact { type, data } shape', () => {
    const uiMessage = AIV4Adapter.toUIMessage(dbMessage);
    expect(uiMessage.parts).toContainEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('AIV6Adapter round-trips data parts to exact { type, data } shape', () => {
    const uiMessage = AIV6Adapter.toUIMessage(dbMessage);
    expect(uiMessage.role).toBe('assistant');
    expect(uiMessage.parts).toContainEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('does NOT produce data-data-* re-prefixed type on reload', () => {
    for (const adapter of [AIV5Adapter, AIV4Adapter, AIV6Adapter]) {
      const uiMessage = adapter.toUIMessage(dbMessage);
      for (const part of uiMessage.parts!) {
        const p = part as { type: string };
        if (p.type.startsWith('data-')) {
          expect(p.type).not.toMatch(/^data-data-/);
        }
      }
    }
  });

  it('regular signals still go through signal adapter path unchanged', () => {
    const signalDb: MastraDBMessage = {
      id: 'sig-1',
      role: 'signal',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      threadId: 'thread-1',
      type: 'system-reminder',
      content: {
        format: 2,
        parts: [{ type: 'text', text: '' }],
        metadata: {
          signal: {
            id: 'sig-1',
            type: 'system-reminder',
            contents: 'continue',
            createdAt: '2024-01-01T00:00:00.000Z',
            metadata: { reminderType: 'retry' },
          },
        },
      },
    };
    const v5Msg = AIV5Adapter.toUIMessage(signalDb);
    expect(v5Msg.parts[0]).toEqual({
      type: 'data-system-reminder',
      data: {
        id: 'sig-1',
        type: 'system-reminder',
        contents: 'continue',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: { reminderType: 'retry' },
      },
    });
  });

  describe('OM lifecycle markers live-vs-reloaded shape', () => {
    const omMarkers = [
      {
        type: 'data-om-buffering-start' as const,
        data: { threadId: 'thread-1', status: 'buffering' },
      },
      {
        type: 'data-om-buffering-end' as const,
        data: { threadId: 'thread-1', observations: ['obs-1', 'obs-2'] },
      },
      {
        type: 'data-om-buffering-failed' as const,
        data: { threadId: 'thread-1', error: 'timeout' },
      },
      {
        type: 'data-om-reflecting-start' as const,
        data: { threadId: 'thread-1' },
      },
      {
        type: 'data-om-reflecting-end' as const,
        data: { threadId: 'thread-1', reflected: true },
      },
    ];

    for (const marker of omMarkers) {
      it(`${marker.type} round-trips with identical shape`, () => {
        const persisted = dataPartToDBMessage(marker, {
          threadId: 'thread-1',
          resourceId: 'user-1',
        });

        expect(persisted.role).toBe('assistant');

        for (const adapter of [AIV5Adapter, AIV4Adapter, AIV6Adapter]) {
          const uiMessage = adapter.toUIMessage(persisted);
          const part = uiMessage.parts!.find((p: any) => p.type === marker.type) as {
            type: string;
            data: unknown;
          };
          expect(part).toBeDefined();
          expect(part.type).toBe(marker.type);
          expect(part.data).toEqual(marker.data);
        }
      });
    }
  });
});
