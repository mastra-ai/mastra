import { describe, expect, it } from 'vitest';

import { dataPartToDBMessage, isDataPartDBMessage } from '../../signals';
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

  it('dataPartToDBMessage stores under metadata.dataPart (not metadata.signal)', () => {
    expect(dbMessage.role).toBe('signal');
    expect(dbMessage.type).toBe('data-om-observation');
    expect(dbMessage.content.metadata).toHaveProperty('dataPart');
    expect(dbMessage.content.metadata).not.toHaveProperty('signal');
    expect((dbMessage.content.metadata as any).dataPart).toEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('isDataPartDBMessage correctly identifies data-part records', () => {
    expect(isDataPartDBMessage(dbMessage)).toBe(true);

    const regularSignal: MastraDBMessage = {
      id: 'sig-1',
      role: 'signal',
      createdAt: new Date(),
      threadId: 'thread-1',
      type: 'system-reminder',
      content: {
        format: 2,
        parts: [{ type: 'text', text: '' }],
        metadata: {
          signal: { id: 'sig-1', type: 'system-reminder', createdAt: new Date().toISOString() },
        },
      },
    };
    expect(isDataPartDBMessage(regularSignal)).toBe(false);

    const userMsg: MastraDBMessage = {
      id: 'msg-1',
      role: 'user',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    };
    expect(isDataPartDBMessage(userMsg)).toBe(false);
  });

  it('AIV5Adapter round-trips data parts to exact { type, data } shape', () => {
    const uiMessage = AIV5Adapter.toUIMessage(dbMessage);
    expect(uiMessage.role).toBe('system');
    expect(uiMessage.parts).toHaveLength(1);
    expect(uiMessage.parts[0]).toEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('AIV4Adapter round-trips data parts to exact { type, data } shape', () => {
    const uiMessage = AIV4Adapter.toUIMessage(dbMessage);
    expect(uiMessage.parts).toHaveLength(1);
    expect(uiMessage.parts![0]).toEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('AIV6Adapter round-trips data parts to exact { type, data } shape', () => {
    const uiMessage = AIV6Adapter.toUIMessage(dbMessage);
    expect(uiMessage.role).toBe('system');
    expect(uiMessage.parts).toHaveLength(1);
    expect(uiMessage.parts[0]).toEqual({
      type: 'data-om-observation',
      data: { observationId: 'obs-1', summary: 'User prefers dark mode' },
    });
  });

  it('does NOT produce data-data-* re-prefixed type on reload', () => {
    for (const adapter of [AIV5Adapter, AIV4Adapter, AIV6Adapter]) {
      const uiMessage = adapter.toUIMessage(dbMessage);
      const part = uiMessage.parts![0] as { type: string };
      expect(part.type).toBe('data-om-observation');
      expect(part.type).not.toMatch(/^data-data-/);
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

        for (const adapter of [AIV5Adapter, AIV4Adapter, AIV6Adapter]) {
          const uiMessage = adapter.toUIMessage(persisted);
          const part = uiMessage.parts![0] as { type: string; data: unknown };
          expect(part.type).toBe(marker.type);
          expect(part.data).toEqual(marker.data);
        }
      });
    }
  });
});
