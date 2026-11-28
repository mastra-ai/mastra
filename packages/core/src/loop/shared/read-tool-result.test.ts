import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import { MessageList } from '../../agent/message-list';
import {
  hasPendingProviderToolInvocation,
  hasPendingToolInvocation,
  readToolResultFromMessageList,
  toolResultArgsMatch,
} from './read-tool-result';

type Parts = MastraDBMessage['content']['parts'];

function makeAssistantMessage(parts: Parts, id: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    content: { format: 2, parts },
    createdAt: new Date(),
  };
}

function callPart(
  toolCallId: string,
  args: Record<string, unknown>,
  extra: { providerExecuted?: boolean } = {},
): Parts[number] {
  return {
    type: 'tool-invocation',
    toolInvocation: { state: 'call', toolCallId, toolName: 'lookup', args },
    ...extra,
  } as Parts[number];
}

function resultPart(toolCallId: string, args: Record<string, unknown>, result: unknown): Parts[number] {
  return {
    type: 'tool-invocation',
    toolInvocation: { state: 'result', toolCallId, toolName: 'lookup', args, result },
  } as Parts[number];
}

describe('toolResultArgsMatch', () => {
  it('matches when the caller holds only a sanitized copy of the stored args', () => {
    // A durable tool runs with internal keys stripped; the stored call keeps them.
    expect(toolResultArgsMatch({ value: 'x' }, { value: 'x', _background: true })).toBe(true);
  });

  it('matches exact equal args', () => {
    expect(toolResultArgsMatch({ q: 'a' }, { q: 'a' })).toBe(true);
  });

  it('does not match when a shared key disagrees', () => {
    expect(toolResultArgsMatch({ q: 'b' }, { q: 'a' })).toBe(false);
    expect(toolResultArgsMatch({ q: 'a' }, { q: 'a' })).toBe(true);
  });

  it('does not match when the caller carries a key the stored call lacks', () => {
    expect(toolResultArgsMatch({ q: 'a', extra: 1 }, { q: 'a' })).toBe(false);
  });

  it('treats missing caller args as a wildcard', () => {
    expect(toolResultArgsMatch(undefined, { q: 'a' })).toBe(true);
    expect(toolResultArgsMatch({}, { q: 'a' })).toBe(true);
  });

  it('treats missing stored args as a wildcard', () => {
    expect(toolResultArgsMatch({ q: 'a' }, undefined)).toBe(true);
  });
});

describe('readToolResultFromMessageList', () => {
  function listWith(...messages: MastraDBMessage[]): MessageList {
    const list = new MessageList();
    for (const message of messages) list.add(message, 'response');
    return list;
  }

  it('reads the newest resolved occurrence when an id is reused', () => {
    const list = listWith(
      makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'result-a' })], 'm1'),
      makeAssistantMessage([resultPart('call_0', { q: 'b' }, { answer: 'result-b' })], 'm2'),
    );

    expect(readToolResultFromMessageList(list, 'call_0', { q: 'a' })).toEqual({ answer: 'result-a' });
    expect(readToolResultFromMessageList(list, 'call_0', { q: 'b' })).toEqual({ answer: 'result-b' });
  });

  it('resolves the right occurrence through sanitized caller args (#31609)', () => {
    const list = listWith(
      makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'result-a' })], 'm1'),
      // Stored call keeps the internal key the durable caller stripped.
      makeAssistantMessage([resultPart('call_0', { q: 'b', _background: true }, { answer: 'result-b' })], 'm2'),
    );

    expect(readToolResultFromMessageList(list, 'call_0', { q: 'b' })).toEqual({ answer: 'result-b' });
    expect(readToolResultFromMessageList(list, 'call_0', { q: 'a' })).toEqual({ answer: 'result-a' });
  });

  it('returns undefined when no occurrence matches the caller args', () => {
    const list = listWith(makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'result-a' })], 'm1'));

    expect(readToolResultFromMessageList(list, 'call_0', { q: 'z' })).toBeUndefined();
  });

  it('returns undefined when the newest matching occurrence is unresolved', () => {
    const list = listWith(
      makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'result-a' })], 'm1'),
      makeAssistantMessage([callPart('call_0', { q: 'b' })], 'm2'),
    );

    expect(readToolResultFromMessageList(list, 'call_0', { q: 'b' })).toBeUndefined();
    expect(readToolResultFromMessageList(list, 'call_0', { q: 'a' })).toEqual({ answer: 'result-a' });
  });

  it('falls back to the newest resolved occurrence when no args are given', () => {
    const list = listWith(
      makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'result-a' })], 'm1'),
      makeAssistantMessage([resultPart('call_0', { q: 'b' }, { answer: 'result-b' })], 'm2'),
    );

    expect(readToolResultFromMessageList(list, 'call_0')).toEqual({ answer: 'result-b' });
  });
});

describe('hasPendingToolInvocation', () => {
  function listWith(...messages: MastraDBMessage[]): MessageList {
    const list = new MessageList();
    for (const message of messages) list.add(message, 'response');
    return list;
  }

  it('reports true while an occurrence of the id is still a call', () => {
    const list = listWith(
      makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'result-a' })], 'm1'),
      makeAssistantMessage([callPart('call_0', { q: 'b' })], 'm2'),
    );

    expect(hasPendingToolInvocation(list, 'call_0')).toBe(true);
  });

  it('reports false once every occurrence is resolved', () => {
    const list = listWith(makeAssistantMessage([resultPart('call_0', { q: 'a' }, { answer: 'a' })], 'm1'));

    expect(hasPendingToolInvocation(list, 'call_0')).toBe(false);
  });
});

describe('hasPendingProviderToolInvocation', () => {
  function listWith(...messages: MastraDBMessage[]): MessageList {
    const list = new MessageList();
    for (const message of messages) list.add(message, 'response');
    return list;
  }

  it('reports true for a still-pending provider call under a different id', () => {
    const list = listWith(makeAssistantMessage([callPart('provider_1', { q: 'a' }, { providerExecuted: true })], 'm1'));

    expect(hasPendingProviderToolInvocation(list, 'lookup')).toBe(true);
    expect(hasPendingProviderToolInvocation(list, 'other')).toBe(false);
  });

  it('ignores resolved provider calls and non-provider calls', () => {
    const resolved = listWith(makeAssistantMessage([resultPart('provider_1', { q: 'a' }, { answer: 'a' })], 'm1'));
    expect(hasPendingProviderToolInvocation(resolved, 'lookup')).toBe(false);

    const clientCall = listWith(makeAssistantMessage([callPart('client_1', { q: 'a' })], 'm2'));
    expect(hasPendingProviderToolInvocation(clientCall, 'lookup')).toBe(false);
  });

  it('keeps the different-id deferred reconciliation path open (#31609)', () => {
    // A provider returns the result under a different id than the stored call. The
    // id-only gate would suppress `updateToolInvocation`, but the name-based gate
    // must keep it running so pass 2 can reconcile by tool name.
    const list = listWith(makeAssistantMessage([callPart('model-call', { q: 'a' }, { providerExecuted: true })], 'm1'));

    expect(hasPendingToolInvocation(list, 'provider-result')).toBe(false);
    expect(hasPendingProviderToolInvocation(list, 'lookup')).toBe(true);
  });
});
