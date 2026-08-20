import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import type { MastraDBMessage } from '../agent/message-list';
import { isMaybeAnthropic, TrailingAssistantGuard } from './trailing-assistant-guard';
import type { ProcessInputStepArgs } from './index';

const createMessage = (role: 'user' | 'assistant', text: string): MastraDBMessage => ({
  id: `${role}-${text}`,
  role,
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
  },
  createdAt: new Date(),
  threadId: 'test-thread',
});

const makeArgs = (
  overrides: Pick<Partial<ProcessInputStepArgs>, 'messages' | 'structuredOutput'> = {},
): ProcessInputStepArgs =>
  ({
    messages: overrides.messages ?? [createMessage('assistant', 'draft response')],
    structuredOutput:
      'structuredOutput' in overrides ? overrides.structuredOutput : { schema: z.object({ answer: z.string() }) },
  }) as ProcessInputStepArgs;

describe('isMaybeAnthropic', () => {
  it('detects Anthropic string model configs across model versions', () => {
    expect(isMaybeAnthropic('anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeAnthropic('anthropic/claude-opus-5')).toBe(true);
  });

  it('rejects non-Anthropic string model configs', () => {
    expect(isMaybeAnthropic('openai/gpt-5')).toBe(false);
    expect(isMaybeAnthropic('openai/claude-opus-4-6')).toBe(false);
  });

  it('detects Anthropic language model objects across model versions', () => {
    expect(isMaybeAnthropic({ provider: 'anthropic', modelId: 'claude-opus-5' })).toBe(true);
    expect(isMaybeAnthropic({ provider: 'anthropic.messages', modelId: 'claude-sonnet-4.6' })).toBe(true);
  });

  it('rejects non-Anthropic language model objects', () => {
    expect(isMaybeAnthropic({ provider: 'openai', modelId: 'gpt-5' })).toBe(false);
    expect(isMaybeAnthropic({ provider: 'openai', modelId: 'claude-opus-4-6' })).toBe(false);
  });

  it('treats dynamic model functions and unknown shapes as possibly Anthropic', () => {
    expect(isMaybeAnthropic(() => 'anthropic/claude-opus-5')).toBe(true);
    expect(isMaybeAnthropic({})).toBe(true);
    expect(isMaybeAnthropic(undefined)).toBe(true);
  });

  it('detects Anthropic providers inside fallback arrays', () => {
    expect(
      isMaybeAnthropic([{ model: 'openai/gpt-5' }, { model: { provider: 'anthropic', modelId: 'claude-opus-5' } }]),
    ).toBe(true);
  });

  it('rejects fallback arrays without an Anthropic candidate', () => {
    expect(
      isMaybeAnthropic([{ model: 'openai/gpt-5' }, { model: { provider: 'google', modelId: 'gemini-2.5-pro' } }]),
    ).toBe(false);
  });
});

describe('TrailingAssistantGuard', () => {
  it('has the expected id and name', () => {
    const guard = new TrailingAssistantGuard();

    expect(guard.id).toBe('trailing-assistant-guard');
    expect(guard.name).toBe('Trailing Assistant Guard');
  });

  it('appends a user continuation message when native structured output follows an assistant message', () => {
    const guard = new TrailingAssistantGuard();
    const messages = [createMessage('user', 'question'), createMessage('assistant', 'draft response')];

    const result = guard.processInputStep(makeArgs({ messages }));

    expect(result?.messages).toHaveLength(3);
    expect(result?.messages?.slice(0, 2)).toEqual(messages);
    expect(result?.messages?.[2]).toMatchObject({
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Generate the structured response.' }],
      },
    });
    expect(result?.messages?.[2]?.id).toEqual(expect.any(String));
    expect(result?.messages?.[2]?.createdAt).toBeInstanceOf(Date);
  });

  it('does not append a message when structured output has no schema', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ structuredOutput: undefined }));

    expect(result).toBeUndefined();
  });

  it('does not append a message when structured output uses a separate model', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(
      makeArgs({
        structuredOutput: {
          schema: z.object({ answer: z.string() }),
          model: 'anthropic/claude-opus-4-6',
        },
      }),
    );

    expect(result).toBeUndefined();
  });

  it('does not append a message when JSON prompt injection is enabled', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(
      makeArgs({
        structuredOutput: {
          schema: z.object({ answer: z.string() }),
          jsonPromptInjection: true,
        },
      }),
    );

    expect(result).toBeUndefined();
  });

  it('does not append a message when the last message is not from the assistant', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ messages: [createMessage('user', 'question')] }));

    expect(result).toBeUndefined();
  });

  it('does not append a message when there are no messages', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ messages: [] }));

    expect(result).toBeUndefined();
  });
});
