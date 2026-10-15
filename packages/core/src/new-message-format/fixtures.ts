import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { MastraDBMessage } from '../agent/message-list/state/types';

export const textStreamFixture: LanguageModelV2StreamPart[] = [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: 'Hello' },
  { type: 'text-delta', id: 'text-1', delta: ', ' },
  { type: 'text-delta', id: 'text-1', delta: 'world!' },
  { type: 'text-end', id: 'text-1' },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
  },
];

export const textDBMessageFixture: MastraDBMessage = {
  id: 'msg-1',
  role: 'assistant',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: {
    format: 2,
    parts: [{ type: 'text', text: 'Hello, world!' }],
    content: 'Hello, world!',
  },
};
