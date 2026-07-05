import { describe, it, expect } from 'vitest';
import { TrailingAssistantGuard, isMaybeClaude46 } from './trailing-assistant-guard';
import type { ProcessInputStepArgs } from './index';

describe('isMaybeClaude46', () => {
  it('returns true for string model configs that look like Claude 4.6', () => {
    expect(isMaybeClaude46('anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeClaude46('anthropic/claude-sonnet-4.6')).toBe(true);
  });

  it('returns false for non-Claude providers', () => {
    expect(isMaybeClaude46('openai/gpt-4o')).toBe(false);
    expect(isMaybeClaude46('google/gemini-pro')).toBe(false);
  });

  it('returns false for Claude models that are not 4.6', () => {
    expect(isMaybeClaude46('anthropic/claude-opus-4')).toBe(false);
    expect(isMaybeClaude46('anthropic/claude-3-5-sonnet')).toBe(false);
    expect(isMaybeClaude46('anthropic/claude-sonnet-4')).toBe(false);
  });

  it('handles language model objects with provider and modelId', () => {
    expect(isMaybeClaude46({ provider: 'anthropic', modelId: 'claude-opus-4-6' })).toBe(true);
    expect(isMaybeClaude46({ provider: 'openai', modelId: 'gpt-4o' })).toBe(false);
    expect(isMaybeClaude46({ provider: 'anthropic', modelId: 'claude-3-5-sonnet' })).toBe(false);
  });

  it('returns true for function model configs (safe default)', () => {
    expect(isMaybeClaude46(() => 'anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeClaude46(async () => ({}))).toBe(true);
  });

  it('handles fallback arrays, true if any entry matches', () => {
    const arr = [
      { model: 'openai/gpt-4o', enabled: true },
      { model: 'anthropic/claude-opus-4-6', enabled: true },
    ];
    expect(isMaybeClaude46(arr)).toBe(true);
  });

  it('handles fallback arrays, false when none match', () => {
    const arr = [
      { model: 'openai/gpt-4o', enabled: true },
      { model: 'anthropic/claude-3-5-sonnet', enabled: true },
    ];
    expect(isMaybeClaude46(arr)).toBe(false);
  });

  it('returns true for unknown shapes (safe default)', () => {
    expect(isMaybeClaude46({})).toBe(true);
    expect(isMaybeClaude46(42)).toBe(true);
    expect(isMaybeClaude46(null)).toBe(true);
  });
});

describe('TrailingAssistantGuard', () => {
  const guard = new TrailingAssistantGuard();

  it('has the correct id and name', () => {
    expect(guard.id).toBe('trailing-assistant-guard');
    expect(guard.name).toBe('Trailing Assistant Guard');
  });

  it('returns undefined when structured output schema is missing', () => {
    const args = { messages: [{ role: 'assistant', content: 'hi' }], structuredOutput: {} } as unknown as ProcessInputStepArgs;
    expect(guard.processInputStep(args)).toBeUndefined();
  });

  it('returns undefined when jsonPromptInjection is set', () => {
    const args = {
      messages: [{ role: 'assistant', content: 'hi' }],
      structuredOutput: { schema: {}, jsonPromptInjection: true },
    } as unknown as ProcessInputStepArgs;
    expect(guard.processInputStep(args)).toBeUndefined();
  });

  it('returns undefined when a model is specified in structuredOutput', () => {
    const args = {
      messages: [{ role: 'assistant', content: 'hi' }],
      structuredOutput: { schema: {}, model: {} },
    } as unknown as ProcessInputStepArgs;
    expect(guard.processInputStep(args)).toBeUndefined();
  });

  it('returns undefined when the last message is not an assistant message', () => {
    const args = {
      messages: [{ role: 'user', content: 'hi' }],
      structuredOutput: { schema: {} },
    } as unknown as ProcessInputStepArgs;
    expect(guard.processInputStep(args)).toBeUndefined();
  });

  it('returns undefined when messages array is empty', () => {
    const args = { messages: [], structuredOutput: { schema: {} } } as unknown as ProcessInputStepArgs;
    expect(guard.processInputStep(args)).toBeUndefined();
  });

  it('appends a user message when last message is assistant and response format is in use', () => {
    const messages = [{ id: 'a1', role: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'partial' }] }, createdAt: new Date() }];
    const args = {
      messages,
      structuredOutput: { schema: {} },
    } as unknown as ProcessInputStepArgs;

    const result = guard.processInputStep(args);
    expect(result).toBeDefined();
    expect(result?.messages).toHaveLength(2);
    const appended = result?.messages[1];
    expect(appended?.role).toBe('user');
    expect(appended?.id).toEqual(expect.any(String));
    const part = (appended?.content as any).parts[0];
    expect(part.type).toBe('text');
    expect(typeof part.text).toBe('string');
    expect(appended?.createdAt).toBeInstanceOf(Date);
  });

  it('preserves the original messages when appending the guard', () => {
    const original = [
      { id: 'u1', role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'q' }] }, createdAt: new Date() },
      { id: 'a1', role: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'a' }] }, createdAt: new Date() },
    ];
    const args = { messages: original, structuredOutput: { schema: {} } } as unknown as ProcessInputStepArgs;

    const result = guard.processInputStep(args);
    expect(result?.messages.slice(0, 2)).toEqual(original);
    expect(result?.messages).toHaveLength(3);
  });
});
