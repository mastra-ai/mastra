import { llm } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import { chatContextToMessages, extractNewTurnMessages } from './messages';

describe('extractNewTurnMessages', () => {
  it('returns an empty array for an empty context', () => {
    expect(extractNewTurnMessages(llm.ChatContext.empty())).toEqual([]);
  });

  it('returns the latest user message', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'Hello there' });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'Hello there' }]);
  });

  it('excludes messages at or before the last assistant reply', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'First question' });
    ctx.addMessage({ role: 'assistant', content: 'First answer' });
    ctx.addMessage({ role: 'user', content: 'Second question' });
    ctx.addMessage({ role: 'user', content: 'Are you there?' });
    expect(extractNewTurnMessages(ctx)).toEqual([
      { role: 'user', content: 'Second question' },
      { role: 'user', content: 'Are you there?' },
    ]);
  });

  it('maps developer and system messages to system role', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'q' });
    ctx.addMessage({ role: 'assistant', content: 'a' });
    ctx.addMessage({ role: 'developer', content: 'Greet the user warmly.' });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'system', content: 'Greet the user warmly.' }]);
  });

  it('joins multi-part string content and skips empty messages', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: ['part one', 'part two'] });
    ctx.addMessage({ role: 'user', content: [] });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'part one\npart two' }]);
  });
});

describe('chatContextToMessages', () => {
  it('converts the full history and skips function calls', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'First question' });
    ctx.addMessage({ role: 'assistant', content: 'First answer' });
    ctx.insert(llm.FunctionCall.create({ callId: 'c1', name: 'lookup', args: '{}' }));
    ctx.addMessage({ role: 'user', content: 'Second question' });
    expect(chatContextToMessages(ctx)).toEqual([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
    ]);
  });
});
