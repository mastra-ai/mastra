import { llm } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import { chatContextToMessages, extractNewTurnMessages, LIVEKIT_INSTRUCTIONS_MESSAGE_ID } from './messages';

describe('extractNewTurnMessages', () => {
  it('returns an empty array for an empty context', () => {
    expect(extractNewTurnMessages(llm.ChatContext.empty())).toEqual([]);
  });

  it('returns the latest user message', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'Hello there', id: 'u1' });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'Hello there', id: 'u1' }]);
  });

  it('excludes messages at or before the last assistant reply', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'First question', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'First answer', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'Second question', id: 'u2' });
    ctx.addMessage({ role: 'user', content: 'Are you there?', id: 'u3' });
    expect(extractNewTurnMessages(ctx)).toEqual([
      { role: 'user', content: 'Second question', id: 'u2' },
      { role: 'user', content: 'Are you there?', id: 'u3' },
    ]);
  });

  it('maps developer and system messages to system role', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'q', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'a', id: 'a1' });
    ctx.addMessage({ role: 'developer', content: 'Greet the user warmly.', id: 'd1' });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'system', content: 'Greet the user warmly.', id: 'd1' }]);
  });

  it('joins multi-part string content and skips empty messages', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: ['part one', 'part two'], id: 'u1' });
    ctx.addMessage({ role: 'user', content: [], id: 'u2' });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'part one\npart two', id: 'u1' }]);
  });

  it('carries the LiveKit ChatMessage.id on each message', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'Hello', id: 'msg-42' });
    expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'Hello', id: 'msg-42' }]);
  });

  describe('filters the LiveKit-injected instructions system message', () => {
    it('drops it on the first turn (no assistant message yet)', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'system', content: 'LiveKit-side instructions', id: LIVEKIT_INSTRUCTIONS_MESSAGE_ID });
      ctx.addMessage({ role: 'user', content: 'Hi there', id: 'u1' });
      expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'Hi there', id: 'u1' }]);
    });

    it('drops it even when it somehow trails the last assistant message', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'assistant', content: 'earlier answer', id: 'a1' });
      ctx.addMessage({ role: 'system', content: 'LiveKit-side instructions', id: LIVEKIT_INSTRUCTIONS_MESSAGE_ID });
      ctx.addMessage({ role: 'user', content: 'next question', id: 'u1' });
      expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'next question', id: 'u1' }]);
    });
  });

  describe('self-heals an interrupted assistant fragment on the next turn', () => {
    it('re-sends the interrupted fragment first, before the new user message', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'user', content: 'first question', id: 'u1' });
      ctx.addMessage({ role: 'assistant', content: 'I was saying', id: 'a1', interrupted: true });
      ctx.addMessage({ role: 'user', content: 'sorry, go on', id: 'u2' });
      expect(extractNewTurnMessages(ctx)).toEqual([
        { role: 'assistant', content: 'I was saying', id: 'a1' },
        { role: 'user', content: 'sorry, go on', id: 'u2' },
      ]);
    });

    it('does not re-send the fragment once a full reply has followed (turn N+2)', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'user', content: 'first question', id: 'u1' });
      ctx.addMessage({ role: 'assistant', content: 'I was saying', id: 'a1', interrupted: true });
      ctx.addMessage({ role: 'user', content: 'sorry, go on', id: 'u2' });
      ctx.addMessage({ role: 'assistant', content: 'As I was saying, here it is.', id: 'a2' });
      ctx.addMessage({ role: 'user', content: 'thanks', id: 'u3' });
      // The completed reply is now the last assistant message, so the earlier fragment is not re-sent.
      expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'thanks', id: 'u3' }]);
    });

    it('heals consecutive interruptions each on the following turn', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'user', content: 'q1', id: 'u1' });
      ctx.addMessage({ role: 'assistant', content: 'first partial', id: 'a1', interrupted: true });
      ctx.addMessage({ role: 'user', content: 'q2', id: 'u2' });
      ctx.addMessage({ role: 'assistant', content: 'second partial', id: 'a2', interrupted: true });
      ctx.addMessage({ role: 'user', content: 'q3', id: 'u3' });
      // Only the most recent interrupted fragment heals; the earlier one already healed last turn.
      expect(extractNewTurnMessages(ctx)).toEqual([
        { role: 'assistant', content: 'second partial', id: 'a2' },
        { role: 'user', content: 'q3', id: 'u3' },
      ]);
    });

    it('adds nothing when the interrupted fragment has no text', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'user', content: 'first question', id: 'u1' });
      ctx.addMessage({ role: 'assistant', content: [], id: 'a1', interrupted: true });
      ctx.addMessage({ role: 'user', content: 'go on', id: 'u2' });
      expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'go on', id: 'u2' }]);
    });

    it('leaves a non-interrupted last assistant message unchanged', () => {
      const ctx = llm.ChatContext.empty();
      ctx.addMessage({ role: 'user', content: 'first question', id: 'u1' });
      ctx.addMessage({ role: 'assistant', content: 'complete answer', id: 'a1' });
      ctx.addMessage({ role: 'user', content: 'next', id: 'u2' });
      expect(extractNewTurnMessages(ctx)).toEqual([{ role: 'user', content: 'next', id: 'u2' }]);
    });
  });
});

describe('chatContextToMessages', () => {
  it('converts the full history and skips function calls', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'user', content: 'First question', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'First answer', id: 'a1' });
    ctx.insert(llm.FunctionCall.create({ callId: 'c1', name: 'lookup', args: '{}' }));
    ctx.addMessage({ role: 'user', content: 'Second question', id: 'u2' });
    expect(chatContextToMessages(ctx)).toEqual([
      { role: 'user', content: 'First question', id: 'u1' },
      { role: 'assistant', content: 'First answer', id: 'a1' },
      { role: 'user', content: 'Second question', id: 'u2' },
    ]);
  });

  it('excludes the LiveKit-injected instructions message and carries ids', () => {
    const ctx = llm.ChatContext.empty();
    ctx.addMessage({ role: 'system', content: 'LiveKit-side instructions', id: LIVEKIT_INSTRUCTIONS_MESSAGE_ID });
    ctx.addMessage({ role: 'user', content: 'First question', id: 'u1' });
    ctx.addMessage({ role: 'assistant', content: 'First answer', id: 'a1' });
    ctx.addMessage({ role: 'user', content: 'Second question', id: 'u2' });
    expect(chatContextToMessages(ctx)).toEqual([
      { role: 'user', content: 'First question', id: 'u1' },
      { role: 'assistant', content: 'First answer', id: 'a1' },
      { role: 'user', content: 'Second question', id: 'u2' },
    ]);
  });
});
