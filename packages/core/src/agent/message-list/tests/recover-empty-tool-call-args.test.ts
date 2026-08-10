import { describe, it, expect } from 'vitest';
import { MessageList } from '../index';
import type { MastraDBMessage } from '../types';

/**
 * A client tool-result persisted without its originating tool-call is stored with
 * `args: {}`. Left empty in storage, that `{}` is replayed to the model as an
 * argument-less tool call and imitated on later turns (regression of #16017).
 *
 * findToolCallArgs already recovers the args when building the prompt, but the
 * stored message itself stays empty. MessageList should backfill the args from
 * the originating call at store time so the persisted message is correct for
 * every reader, not just the prompt path.
 */
describe('MessageList - backfill empty tool-call args at store time', () => {
  type StoredInvocation = { state?: string; args?: unknown; result?: unknown };

  const invocationsFor = (stored: MastraDBMessage[], toolCallId: string): StoredInvocation[] => {
    const out: StoredInvocation[] = [];
    for (const message of stored) {
      for (const part of message.content.parts ?? []) {
        if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId) {
          out.push(part.toolInvocation as StoredInvocation);
        }
      }
      for (const invocation of message.content.toolInvocations ?? []) {
        if (invocation.toolCallId === toolCallId) out.push(invocation as StoredInvocation);
      }
    }
    return out;
  };

  it('stores the original args on a tool-result that arrived without its call', () => {
    const messageList = new MessageList();

    messageList.add({ role: 'user', content: 'Get the weather for San Francisco' }, 'input');
    messageList.add(
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'getWeather', args: { city: 'San Francisco' } },
        ],
      },
      'response',
    );
    // Client tool result comes back without its args (the split-message case).
    messageList.add(
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'getWeather', result: { temperature: 18 } }],
      },
      'response',
    );

    const invocations = invocationsFor(messageList.get.all.db(), 'call-1');

    // The result must actually be stored (not dropped) with its payload...
    const resultInvocation = invocations.find(inv => inv.state === 'result');
    expect(resultInvocation).toBeDefined();
    expect(resultInvocation?.result).toEqual({ temperature: 18 });

    // ...and every stored copy of the call must carry the original args.
    expect(invocations.length).toBeGreaterThan(0);
    for (const inv of invocations) {
      expect(inv.args).toEqual({ city: 'San Francisco' });
    }
  });

  it('leaves a genuinely argument-less call untouched (nothing to recover)', () => {
    const messageList = new MessageList();

    messageList.add({ role: 'user', content: 'List every connection' }, 'input');
    messageList.add(
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-2', toolName: 'getConnections', args: {} }],
      },
      'response',
    );
    messageList.add(
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'call-2', toolName: 'getConnections', result: { count: 3 } }],
      },
      'response',
    );

    const invocations = invocationsFor(messageList.get.all.db(), 'call-2');

    // A matching stored result must exist, and args stay empty (nothing to recover).
    const resultInvocation = invocations.find(inv => inv.state === 'result');
    expect(resultInvocation).toBeDefined();
    expect(invocations.length).toBeGreaterThan(0);
    for (const inv of invocations) {
      expect(inv.args).toEqual({});
    }
  });
});
