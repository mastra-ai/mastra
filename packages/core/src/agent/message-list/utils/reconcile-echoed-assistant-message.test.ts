import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import { reconcileEchoedAssistantMessage } from './reconcile-echoed-assistant-message';

const rs = { openai: { itemId: 'rs_1', reasoningEncryptedContent: null } };
const msg = { openai: { itemId: 'msg_1' } };

function assistant(parts: any[], overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
  return {
    id: 'a1',
    role: 'assistant',
    createdAt: new Date(0),
    threadId: 't',
    resourceId: 'r',
    content: { format: 2, parts },
    ...overrides,
  } as MastraDBMessage;
}

const storedParts = [
  { type: 'reasoning', text: '', providerMetadata: rs },
  { type: 'text', text: 'Hi.', providerMetadata: msg },
];

describe('reconcileEchoedAssistantMessage', () => {
  it('returns undefined when the echo is not lossy', () => {
    const stored = assistant(storedParts);
    const echoed = assistant(storedParts);
    expect(reconcileEchoedAssistantMessage(stored, echoed)).toBeUndefined();
  });

  it('returns undefined for non-assistant messages', () => {
    const stored = assistant(storedParts, { role: 'user' });
    const echoed = assistant([{ type: 'text', text: 'Hi.' }], { role: 'user' });
    expect(reconcileEchoedAssistantMessage(stored, echoed)).toBeUndefined();
  });

  it('returns undefined when neither side has reasoning or provider metadata', () => {
    const stored = assistant([{ type: 'text', text: 'Hi.' }]);
    const echoed = assistant([{ type: 'text', text: 'Hi.' }]);
    expect(reconcileEchoedAssistantMessage(stored, echoed)).toBeUndefined();
  });

  it('restores stripped reasoning and provider metadata from the stored copy', () => {
    const stored = assistant(storedParts);
    const echoed = assistant([{ type: 'text', text: 'Hi.' }]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual(storedParts);
  });

  it('restores reasoning when the echo kept text provider metadata', () => {
    const stored = assistant(storedParts);
    const echoed = assistant([{ type: 'text', text: 'Hi.', providerMetadata: msg }]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual(storedParts);
  });

  it('restores only the reasoning parts omitted from a partial echo', () => {
    const secondReasoning = {
      type: 'reasoning',
      text: 'second',
      providerMetadata: { openai: { itemId: 'rs_2', reasoningEncryptedContent: null } },
    };
    const stored = assistant([storedParts[0], secondReasoning, storedParts[1]]);
    const echoed = assistant([storedParts[0], storedParts[1]]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual(stored.content.parts);
  });

  it('keeps client-side tool output added to the echo while restoring reasoning', () => {
    const stored = assistant([
      { type: 'reasoning', text: '', providerMetadata: rs },
      {
        type: 'tool-getWeather',
        toolCallId: 'call_1',
        state: 'input-available',
        input: { city: 'SF' },
        providerMetadata: { openai: { itemId: 'fc_1' } },
      },
    ]);
    const echoed = assistant([
      {
        type: 'tool-getWeather',
        toolCallId: 'call_1',
        state: 'output-available',
        input: { city: 'SF' },
        output: '72F',
      },
    ]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual([
      { type: 'reasoning', text: '', providerMetadata: rs },
      {
        type: 'tool-getWeather',
        toolCallId: 'call_1',
        state: 'output-available',
        input: { city: 'SF' },
        output: '72F',
        providerMetadata: { openai: { itemId: 'fc_1' } },
      },
    ]);
  });

  it('appends parts the echo has that the stored copy does not', () => {
    const stored = assistant(storedParts);
    const echoed = assistant([
      { type: 'text', text: 'Hi.' },
      { type: 'text', text: 'client-only' },
    ]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual([...storedParts, { type: 'text', text: 'client-only' }]);
  });

  it('restores per-part metadata when only some echoed parts lost it', () => {
    const stored = assistant([
      { type: 'text', text: 'One.', providerMetadata: { openai: { itemId: 'msg_1' } } },
      { type: 'text', text: 'Two.', providerMetadata: { openai: { itemId: 'msg_2' } } },
    ]);
    const echoed = assistant([
      { type: 'text', text: 'One.', providerMetadata: { openai: { itemId: 'msg_1' } } },
      { type: 'text', text: 'Two.' },
    ]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual(stored.content.parts);
  });

  it('merges metadata per namespace: echoed keys win, stored keys fill gaps', () => {
    const stored = assistant([
      {
        type: 'text',
        text: 'Hi.',
        providerMetadata: { openai: { itemId: 'msg_1', extra: 'stored' }, azure: { itemId: 'az_1' } },
      },
    ]);
    const echoed = assistant([
      { type: 'text', text: 'Hi.', providerMetadata: { openai: { extra: 'client' }, client: { flag: true } } },
    ]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual([
      {
        type: 'text',
        text: 'Hi.',
        providerMetadata: {
          openai: { itemId: 'msg_1', extra: 'client' },
          azure: { itemId: 'az_1' },
          client: { flag: true },
        },
      },
    ]);
  });

  it('matches repeated identical parts one-to-one', () => {
    const stored = assistant([
      { type: 'text', text: 'Same.', providerMetadata: { openai: { itemId: 'msg_1' } } },
      { type: 'text', text: 'Same.', providerMetadata: { openai: { itemId: 'msg_2' } } },
    ]);
    const echoed = assistant([
      { type: 'text', text: 'Same.' },
      { type: 'text', text: 'Same.' },
    ]);
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.content.parts).toEqual(stored.content.parts);
    expect(result.content.parts).toHaveLength(2);
  });

  it('keeps stored identity/timestamps and merges content metadata', () => {
    const stored = assistant(storedParts, { createdAt: new Date(1000) });
    stored.content.metadata = { fromStore: true };
    const echoed = assistant([{ type: 'text', text: 'Hi.' }], { createdAt: new Date(2000) });
    echoed.content.metadata = { fromClient: true };
    const result = reconcileEchoedAssistantMessage(stored, echoed)!;
    expect(result.createdAt).toEqual(new Date(1000));
    expect(result.content.metadata).toEqual({ fromStore: true, fromClient: true });
  });
});
