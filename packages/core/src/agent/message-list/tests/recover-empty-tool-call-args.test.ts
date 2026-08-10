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
  const argsFor = (stored: MastraDBMessage[], toolCallId: string): Array<unknown> => {
    const out: Array<unknown> = [];
    for (const message of stored) {
      for (const part of message.content.parts ?? []) {
        if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId) {
          out.push(part.toolInvocation.args);
        }
      }
      for (const invocation of message.content.toolInvocations ?? []) {
        if (invocation.toolCallId === toolCallId) out.push(invocation.args);
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

    // The stored message — not just the prompt output — must carry the args.
    const stored = messageList.get.all.db();
    const seen = argsFor(stored, 'call-1');

    expect(seen.length).toBeGreaterThan(0);
    for (const args of seen) {
      expect(args).toEqual({ city: 'San Francisco' });
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

    const stored = messageList.get.all.db();
    for (const args of argsFor(stored, 'call-2')) {
      expect(args).toEqual({});
    }
  });
});
