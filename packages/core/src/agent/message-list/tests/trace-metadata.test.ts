import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';

function makeMessage(role: 'user' | 'assistant', parts: MastraDBMessage['content']['parts']): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: { format: 2, parts },
    createdAt: new Date(),
  };
}

describe('MessageList trace metadata stamping', () => {
  it('stamps drained response messages with traceId/agentRunSpanId', () => {
    const list = new MessageList();
    list.setResponseTraceContext({ traceId: 'trace-1', agentRunSpanId: 'span-1' });

    list.add(makeMessage('assistant', [{ type: 'text', text: 'hello' }]), 'response');

    const drained = list.drainUnsavedMessages();
    expect(drained).toHaveLength(1);
    expect(drained[0]!.content.metadata?.mastra).toEqual({ traceId: 'trace-1', agentRunSpanId: 'span-1' });
  });

  it('does not stamp user messages', () => {
    const list = new MessageList();
    list.setResponseTraceContext({ traceId: 'trace-1', agentRunSpanId: 'span-1' });

    list.add(makeMessage('user', [{ type: 'text', text: 'hi' }]), 'user');

    const drained = list.drainUnsavedMessages();
    expect(drained).toHaveLength(1);
    expect(drained[0]!.content.metadata?.mastra).toBeUndefined();
  });

  it('preserves existing metadata and merges into an existing mastra namespace', () => {
    const list = new MessageList();
    list.setResponseTraceContext({ traceId: 'trace-1', agentRunSpanId: 'span-1' });

    const msg = makeMessage('assistant', [{ type: 'text', text: 'hello' }]);
    msg.content.metadata = { custom: 'value', mastra: { other: true } };
    list.add(msg, 'response');

    const drained = list.drainUnsavedMessages();
    expect(drained[0]!.content.metadata).toEqual({
      custom: 'value',
      mastra: { other: true, traceId: 'trace-1', agentRunSpanId: 'span-1' },
    });
  });

  it('does not stamp when no trace context is set', () => {
    const list = new MessageList();
    list.add(makeMessage('assistant', [{ type: 'text', text: 'hello' }]), 'response');

    const drained = list.drainUnsavedMessages();
    expect(drained[0]!.content.metadata).toBeUndefined();
  });
});
