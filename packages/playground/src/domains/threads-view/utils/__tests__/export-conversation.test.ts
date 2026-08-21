import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import type { FeedbackRecord } from '@mastra/core/storage';
import { TraceStatus } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import type { ConversationThread } from '../../hooks/use-conversation-threads';
import { buildConversationExport } from '../export-conversation';

type TraceRootSpan = Awaited<ReturnType<MastraClient['listTraces']>>['spans'][number];

const turn: TraceRootSpan = {
  traceId: 'trace-1',
  spanId: 'span-1',
  name: "agent run: 'clinical-diagnosis-agent'",
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-08-21T10:00:00.000Z'),
  endedAt: new Date('2026-08-21T10:00:05.000Z'),
  createdAt: new Date('2026-08-21T10:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
  entityName: 'Clinical Diagnosis Agent',
  input: [{ role: 'user', content: 'Chest pain case.' }],
  output: { text: 'Evaluate urgently.' },
};

const thread: ConversationThread = {
  threadKey: 'thread:demo',
  isConversation: true,
  turns: [turn],
  actors: ['Clinical Diagnosis Agent'],
  startedAt: turn.startedAt,
  lastActivityAt: turn.endedAt!,
  hasErrors: false,
};

const feedback: FeedbackRecord[] = [
  {
    feedbackId: 'fb-1',
    timestamp: new Date('2026-08-21T11:00:00.000Z'),
    traceId: 'trace-1',
    feedbackType: 'review',
    value: 1,
    comment: 'Sound reasoning.',
    feedbackUserId: 'Dr. Reyes',
  },
  {
    feedbackId: 'fb-2',
    timestamp: new Date('2026-08-21T11:05:00.000Z'),
    traceId: 'trace-1',
    feedbackType: 'annotation',
    value: 'Evaluate urgently',
    comment: 'Needs a timeframe.',
    feedbackUserId: 'Dr. Chen',
    metadata: { reviewTarget: 'response', quote: 'Evaluate urgently' },
  },
];

describe('buildConversationExport', () => {
  describe('when a thread has reviews and annotations', () => {
    it('exports readable turns with attributed reviews and annotations', () => {
      const payload = buildConversationExport(thread, new Map([['trace-1', feedback]]));

      expect(payload.threadKey).toBe('thread:demo');
      expect(payload.turns).toHaveLength(1);
      const exported = payload.turns[0]!;
      expect(exported.actor).toBe('Clinical Diagnosis Agent');
      expect(exported.message).toBe('Chest pain case.');
      expect(exported.response).toBe('Evaluate urgently.');
      expect(exported.reviews).toEqual([
        {
          assessment: 'accurate',
          note: 'Sound reasoning.',
          reviewer: 'Dr. Reyes',
          timestamp: feedback[0]!.timestamp,
        },
      ]);
      expect(exported.annotations).toEqual([
        {
          quote: 'Evaluate urgently',
          note: 'Needs a timeframe.',
          reviewer: 'Dr. Chen',
          timestamp: feedback[1]!.timestamp,
        },
      ]);
      expect(exported.raw.input).toEqual(turn.input);
    });
  });

  describe('when a turn has no feedback', () => {
    it('exports empty review and annotation lists', () => {
      const payload = buildConversationExport(thread, new Map());

      expect(payload.turns[0]!.reviews).toEqual([]);
      expect(payload.turns[0]!.annotations).toEqual([]);
    });
  });
});
