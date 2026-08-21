import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { groupTracesIntoThreads } from '../use-conversation-threads';

type TraceRootSpan = Awaited<ReturnType<MastraClient['listTraces']>>['spans'][number];

const baseSpan: TraceRootSpan = {
  traceId: 'trace-1',
  spanId: 'span-1',
  name: 'agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-08-21T10:00:00.000Z'),
  endedAt: new Date('2026-08-21T10:00:05.000Z'),
  createdAt: new Date('2026-08-21T10:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

describe('groupTracesIntoThreads', () => {
  describe('when turns share a threadId', () => {
    it('groups them into one conversation ordered by start time', () => {
      const threads = groupTracesIntoThreads([
        { ...baseSpan, traceId: 'trace-2', threadId: 'thread-a', startedAt: new Date('2026-08-21T11:00:00.000Z') },
        { ...baseSpan, traceId: 'trace-1', threadId: 'thread-a' },
      ]);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.isConversation).toBe(true);
      expect(threads[0]?.turns.map(turn => turn.traceId)).toEqual(['trace-1', 'trace-2']);
    });
  });

  describe('when a turn has no conversation identifier', () => {
    it('keeps it as a single-turn conversation', () => {
      const threads = groupTracesIntoThreads([baseSpan]);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.isConversation).toBe(false);
      expect(threads[0]?.turns).toHaveLength(1);
    });
  });

  describe('when a turn failed', () => {
    it('marks the conversation as having errors', () => {
      const threads = groupTracesIntoThreads([
        { ...baseSpan, threadId: 'thread-a' },
        { ...baseSpan, traceId: 'trace-2', threadId: 'thread-a', status: TraceStatus.ERROR },
      ]);

      expect(threads[0]?.hasErrors).toBe(true);
    });
  });

  describe('when multiple actors participate', () => {
    it('lists each actor once', () => {
      const threads = groupTracesIntoThreads([
        { ...baseSpan, threadId: 'thread-a', entityName: 'patient-agent' },
        { ...baseSpan, traceId: 'trace-2', threadId: 'thread-a', entityName: 'physician-agent' },
        { ...baseSpan, traceId: 'trace-3', threadId: 'thread-a', entityName: 'patient-agent' },
      ]);

      expect(threads[0]?.actors).toEqual(['patient-agent', 'physician-agent']);
    });
  });

  describe('when conversations are sorted', () => {
    it('puts the most recently active conversation first', () => {
      const threads = groupTracesIntoThreads([
        { ...baseSpan, threadId: 'old', endedAt: new Date('2026-08-21T09:00:00.000Z') },
        {
          ...baseSpan,
          traceId: 'trace-2',
          threadId: 'new',
          endedAt: new Date('2026-08-21T12:00:00.000Z'),
        },
      ]);

      expect(threads.map(thread => thread.threadKey)).toEqual(['thread:new', 'thread:old']);
    });
  });
});
