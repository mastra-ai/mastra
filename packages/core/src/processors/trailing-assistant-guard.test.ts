import { describe, it, expect } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../memory/types';

import { isMaybeClaude46, TrailingAssistantGuard } from './trailing-assistant-guard';

function makeMessages(...roles: Array<'user' | 'assistant'>): MastraDBMessage[] {
  return roles.map((role, i) => ({
    id: `msg-${i}`,
    role,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text: `${role} message ${i}` }],
    },
    createdAt: new Date(Date.now() + i),
  }));
}

function makeArgs(messages: MastraDBMessage[], structuredOutput?: any) {
  const mockAbort = ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;

  return {
    messages,
    messageList: new MessageList({ messages: [] }),
    abort: mockAbort,
    stepNumber: 0,
    steps: [],
    systemMessages: [],
    state: {},
    ...(structuredOutput !== undefined ? { structuredOutput } : {}),
  };
}

describe('TrailingAssistantGuard', () => {
  const guard = new TrailingAssistantGuard();

  describe('without structured output (#13969)', () => {
    it('should append a user message when last message is assistant without structured output', () => {
      const messages = makeMessages('user', 'assistant');
      const result = guard.processInputStep(makeArgs(messages));

      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(3);
      const appended = result!.messages[2]!;
      expect(appended.role).toBe('user');
      expect(appended.content.parts[0].text).toBe('Continue.');
    });

    it('should not modify messages when last message is user without structured output', () => {
      const messages = makeMessages('user', 'assistant', 'user');
      const result = guard.processInputStep(makeArgs(messages));

      expect(result).toBeUndefined();
    });

    it('should handle single assistant message without structured output', () => {
      const messages = makeMessages('assistant');
      const result = guard.processInputStep(makeArgs(messages));

      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[1]!.role).toBe('user');
      expect(result!.messages[1]!.content.parts[0].text).toBe('Continue.');
    });
  });

  describe('with structured output (#12800)', () => {
    const structuredOutput = {
      schema: { type: 'object' },
    };

    it('should append a user message with structured output text when last message is assistant', () => {
      const messages = makeMessages('user', 'assistant');
      const result = guard.processInputStep(makeArgs(messages, structuredOutput));

      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(3);
      const appended = result!.messages[2]!;
      expect(appended.role).toBe('user');
      expect(appended.content.parts[0].text).toBe('Generate the structured response.');
    });

    it('should not modify messages when last message is user with structured output', () => {
      const messages = makeMessages('user');
      const result = guard.processInputStep(makeArgs(messages, structuredOutput));

      expect(result).toBeUndefined();
    });

    it('should use "Continue." when structuredOutput has its own model (no responseFormat)', () => {
      const messages = makeMessages('user', 'assistant');
      const result = guard.processInputStep(makeArgs(messages, { schema: { type: 'object' }, model: 'some-model' }));

      expect(result).toBeDefined();
      expect(result!.messages[2]!.content.parts[0].text).toBe('Continue.');
    });

    it('should use "Continue." when structuredOutput uses jsonPromptInjection (no responseFormat)', () => {
      const messages = makeMessages('user', 'assistant');
      const result = guard.processInputStep(
        makeArgs(messages, { schema: { type: 'object' }, jsonPromptInjection: true }),
      );

      expect(result).toBeDefined();
      expect(result!.messages[2]!.content.parts[0].text).toBe('Continue.');
    });
  });

  describe('edge cases', () => {
    it('should return undefined for empty messages array', () => {
      const result = guard.processInputStep(makeArgs([]));
      expect(result).toBeUndefined();
    });

    it('should preserve all original messages in the returned array', () => {
      const messages = makeMessages('user', 'assistant', 'user', 'assistant');
      const result = guard.processInputStep(makeArgs(messages));

      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(5);
      // Original messages preserved
      for (let i = 0; i < 4; i++) {
        expect(result!.messages[i]).toBe(messages[i]);
      }
    });

    it('should generate a unique id for each appended message', () => {
      const messages = makeMessages('user', 'assistant');
      const result1 = guard.processInputStep(makeArgs(messages));
      const result2 = guard.processInputStep(makeArgs(messages));

      expect(result1!.messages[2]!.id).not.toBe(result2!.messages[2]!.id);
    });
  });
});

describe('isMaybeClaude46', () => {
  it('should return true for anthropic claude 4.6 string', () => {
    expect(isMaybeClaude46('anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeClaude46('anthropic/claude-sonnet-4-6')).toBe(true);
  });

  it('should return false for non-4.6 anthropic models', () => {
    expect(isMaybeClaude46('anthropic/claude-haiku-4-5-20251001')).toBe(false);
    expect(isMaybeClaude46('anthropic/claude-sonnet-3-5')).toBe(false);
  });

  it('should return false for non-anthropic providers', () => {
    expect(isMaybeClaude46('openai/gpt-4o')).toBe(false);
  });

  it('should return true for functions (safe default)', () => {
    expect(isMaybeClaude46(() => 'some-model')).toBe(true);
  });

  it('should return true for unknown types (safe default)', () => {
    expect(isMaybeClaude46(undefined)).toBe(true);
    expect(isMaybeClaude46(null)).toBe(true);
  });

  it('should handle model objects with provider and modelId', () => {
    expect(isMaybeClaude46({ provider: 'anthropic.messages', modelId: 'claude-opus-4-6' })).toBe(true);
    expect(isMaybeClaude46({ provider: 'anthropic.messages', modelId: 'claude-haiku-4-5' })).toBe(false);
    expect(isMaybeClaude46({ provider: 'openai.chat', modelId: 'gpt-4o' })).toBe(false);
  });

  it('should handle model fallback arrays', () => {
    expect(
      isMaybeClaude46([
        { model: 'openai/gpt-4o', enabled: true },
        { model: 'anthropic/claude-opus-4-6', enabled: true },
      ]),
    ).toBe(true);

    expect(
      isMaybeClaude46([
        { model: 'openai/gpt-4o', enabled: true },
        { model: 'anthropic/claude-haiku-4-5', enabled: true },
      ]),
    ).toBe(false);
  });
});
