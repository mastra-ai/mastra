import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { MastraDBMessage } from '../agent/message-list';
import { TrailingAssistantGuard, isMaybeClaude46 } from './trailing-assistant-guard';

function createMessage(text: string, role: 'user' | 'assistant'): MastraDBMessage {
  return {
    id: `msg-${Math.random()}`,
    role,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text }],
    },
    createdAt: new Date(),
    threadId: 'test-thread',
  };
}

describe('TrailingAssistantGuard', () => {
  it('should append a generic continuation for Claude 4.6 prompts that end with assistant without structured output', () => {
    const guard = new TrailingAssistantGuard();
    const messages = [createMessage('Previous assistant reply', 'assistant')];

    const result = guard.processInputStep({
      messages,
      structuredOutput: undefined,
    } as any);

    expect(result?.messages).toHaveLength(2);
    expect(result?.messages?.[1]?.role).toBe('user');
    expect(result?.messages?.[1]?.content.parts).toEqual([{ type: 'text', text: 'Continue.' }]);
  });

  it('should preserve the structured-output continuation when structured output is active', () => {
    const guard = new TrailingAssistantGuard();
    const messages = [createMessage('Previous assistant reply', 'assistant')];

    const result = guard.processInputStep({
      messages,
      structuredOutput: {
        schema: z.object({ ok: z.boolean() }),
      },
    } as any);

    expect(result?.messages).toHaveLength(2);
    expect(result?.messages?.[1]?.content.parts).toEqual([
      { type: 'text', text: 'Generate the structured response.' },
    ]);
  });

  it('should not modify prompts that already end with a user message', () => {
    const guard = new TrailingAssistantGuard();
    const messages = [createMessage('User prompt', 'user')];

    const result = guard.processInputStep({
      messages,
      structuredOutput: undefined,
    } as any);

    expect(result).toBeUndefined();
  });
});

describe('isMaybeClaude46', () => {
  it('should detect anthropic Claude 4.6 string configs', () => {
    expect(isMaybeClaude46('anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeClaude46('anthropic/claude-sonnet-4.6')).toBe(true);
    expect(isMaybeClaude46('openai/gpt-5')).toBe(false);
  });
});
