import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { isMaybeClaude46, TrailingAssistantGuard } from './trailing-assistant-guard';
import type { ProcessInputStepArgs } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(role: 'user' | 'assistant', text = 'hello') {
  return {
    id: randomUUID(),
    role,
    content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
    createdAt: new Date(),
  };
}

function makeArgs(overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs {
  return {
    messages: [],
    retryCount: 0,
    abort: () => {
      throw new Error('abort');
    },
    ...overrides,
  } as ProcessInputStepArgs;
}

// ---------------------------------------------------------------------------
// isMaybeClaude46
// ---------------------------------------------------------------------------

describe('isMaybeClaude46', () => {
  it('returns true for anthropic string models with 4.6 version', () => {
    expect(isMaybeClaude46('anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeClaude46('anthropic/claude-sonnet-4-6')).toBe(true);
    expect(isMaybeClaude46('anthropic/claude-sonnet-4.6')).toBe(true);
  });

  it('returns false for non-anthropic providers', () => {
    expect(isMaybeClaude46('openai/gpt-4')).toBe(false);
    expect(isMaybeClaude46('google/gemini-2.5-flash')).toBe(false);
  });

  it('returns false for older anthropic models', () => {
    expect(isMaybeClaude46('anthropic/claude-3-5-sonnet')).toBe(false);
    expect(isMaybeClaude46('anthropic/claude-3-opus')).toBe(false);
  });

  it('returns true for language model objects with anthropic provider', () => {
    expect(isMaybeClaude46({ provider: 'anthropic.messages', modelId: 'claude-opus-4-6' })).toBe(true);
  });

  it('returns false for non-anthropic language model objects', () => {
    expect(isMaybeClaude46({ provider: 'openai.chat', modelId: 'gpt-4' })).toBe(false);
  });

  it('returns true for functions (safe default)', () => {
    expect(isMaybeClaude46(() => 'model')).toBe(true);
  });

  it('returns true for arrays containing a claude 4.6 model', () => {
    expect(isMaybeClaude46([{ model: 'anthropic/claude-opus-4-6' }, { model: 'openai/gpt-4' }])).toBe(true);
  });

  it('returns false for arrays without claude 4.6', () => {
    expect(isMaybeClaude46([{ model: 'openai/gpt-4' }, { model: 'google/gemini-2.5-flash' }])).toBe(false);
  });

  it('returns true for unknown types (safe default)', () => {
    expect(isMaybeClaude46(42)).toBe(true);
    expect(isMaybeClaude46(null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TrailingAssistantGuard
// ---------------------------------------------------------------------------

describe('TrailingAssistantGuard', () => {
  const guard = new TrailingAssistantGuard();

  it('returns undefined when messages are empty', () => {
    expect(guard.processInputStep(makeArgs({ messages: [] }))).toBeUndefined();
  });

  it('returns undefined when last message is from user', () => {
    const result = guard.processInputStep(makeArgs({ messages: [makeMessage('user')] }));
    expect(result).toBeUndefined();
  });

  it('appends a "Continue." user message when last message is assistant (no structured output)', () => {
    const messages = [makeMessage('user'), makeMessage('assistant')];
    const result = guard.processInputStep(makeArgs({ messages }));

    expect(result).toBeDefined();
    const appended = result!.messages[result!.messages.length - 1];
    expect(appended.role).toBe('user');
    expect(appended.content).toMatchObject({
      format: 2,
      parts: [{ type: 'text', text: 'Continue.' }],
    });
  });

  it('appends "Generate the structured response." when structured output is active', () => {
    const messages = [makeMessage('user'), makeMessage('assistant')];
    const result = guard.processInputStep(
      makeArgs({
        messages,
        structuredOutput: { schema: { type: 'object' } },
      }),
    );

    expect(result).toBeDefined();
    const appended = result!.messages[result!.messages.length - 1];
    expect(appended.content).toMatchObject({
      format: 2,
      parts: [{ type: 'text', text: 'Generate the structured response.' }],
    });
  });

  it('uses "Continue." when structuredOutput has a dedicated model (not using responseFormat)', () => {
    const messages = [makeMessage('user'), makeMessage('assistant')];
    const result = guard.processInputStep(
      makeArgs({
        messages,
        structuredOutput: { schema: { type: 'object' }, model: 'some-model' },
      }),
    );

    expect(result).toBeDefined();
    const appended = result!.messages[result!.messages.length - 1];
    expect(appended.content).toMatchObject({
      parts: [{ type: 'text', text: 'Continue.' }],
    });
  });

  it('uses "Continue." when structuredOutput uses jsonPromptInjection', () => {
    const messages = [makeMessage('user'), makeMessage('assistant')];
    const result = guard.processInputStep(
      makeArgs({
        messages,
        structuredOutput: { schema: { type: 'object' }, jsonPromptInjection: true },
      }),
    );

    expect(result).toBeDefined();
    const appended = result!.messages[result!.messages.length - 1];
    expect(appended.content).toMatchObject({
      parts: [{ type: 'text', text: 'Continue.' }],
    });
  });

  it('preserves all original messages in output', () => {
    const messages = [makeMessage('user'), makeMessage('assistant')];
    const result = guard.processInputStep(makeArgs({ messages }));

    expect(result!.messages.length).toBe(3);
    expect(result!.messages[0]).toBe(messages[0]);
    expect(result!.messages[1]).toBe(messages[1]);
  });
});
