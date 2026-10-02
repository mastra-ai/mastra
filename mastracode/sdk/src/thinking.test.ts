import { describe, expect, it } from 'vitest';

import {
  getAvailableThinkingLevelsForModel,
  parseThinkCommand,
  resolveDefaultThinkingLevel,
  supportsMaxReasoningEffort,
} from './thinking.js';

describe('parseThinkCommand', () => {
  it.each(['', 'status'])('parses %j as a status request', input => {
    expect(parseThinkCommand(input)).toEqual({ kind: 'status' });
  });

  it.each(['default', 'clear'])('parses %s as a clear request', input => {
    expect(parseThinkCommand(input)).toEqual({ kind: 'clear' });
  });

  it('parses a supported level', () => {
    expect(parseThinkCommand(' HIGH ')).toEqual({ kind: 'set', level: 'high' });
  });

  it('rejects trailing arguments instead of silently ignoring them', () => {
    expect(parseThinkCommand('high extra')).toMatchObject({ kind: 'invalid', value: 'high extra' });
  });

  it('rejects levels unavailable for the active model', () => {
    const levels = getAvailableThinkingLevelsForModel('openai/gpt-5.5');

    expect(parseThinkCommand('max', levels)).toEqual({ kind: 'invalid', value: 'max', levels });
  });
});

describe('thinking model capabilities', () => {
  it('supports max reasoning from GPT-5.6 onward', () => {
    expect(supportsMaxReasoningEffort('gpt-5.6')).toBe(true);
    expect(supportsMaxReasoningEffort('openai/gpt-6')).toBe(true);
    expect(supportsMaxReasoningEffort('openai/gpt-5.5')).toBe(false);
  });

  it('keeps max for non-OpenAI models', () => {
    expect(getAvailableThinkingLevelsForModel('anthropic/claude-opus-4-6')).toContain('max');
  });

  it('offers only levels each model runs as themselves', () => {
    expect(getAvailableThinkingLevelsForModel('openai/gpt-5.5')).toEqual(['off', 'low', 'medium', 'high', 'xhigh']);
    expect(getAvailableThinkingLevelsForModel('anthropic/claude-sonnet-4-6')).toEqual([
      'off',
      'low',
      'medium',
      'high',
      'max',
    ]);
    expect(getAvailableThinkingLevelsForModel('google/gemini-3-pro-preview')).toEqual(['off', 'low', 'high']);
    expect(getAvailableThinkingLevelsForModel('google/gemini-2.5-flash')).toEqual(['off', 'low', 'medium', 'high']);
    expect(getAvailableThinkingLevelsForModel('openai/gpt-5')).toEqual(['off', 'low', 'medium', 'high']);
    expect(getAvailableThinkingLevelsForModel('openai/o3')).toEqual(['off', 'low', 'medium', 'high']);
  });

  it('offers only off for models that cannot think', () => {
    expect(getAvailableThinkingLevelsForModel('anthropic/claude-3-5-sonnet-20241022')).toEqual(['off']);
    expect(getAvailableThinkingLevelsForModel('google/gemini-2.0-flash')).toEqual(['off']);
    expect(getAvailableThinkingLevelsForModel('openai/gpt-4o-mini')).toEqual(['off']);
    expect(getAvailableThinkingLevelsForModel('openai/gpt-5-chat-latest')).toEqual(['off']);
  });

  it('passes levels through unchanged for unrecognised providers', () => {
    expect(getAvailableThinkingLevelsForModel('acme/house-model')).toEqual([
      'off',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
  });
});

describe('resolveDefaultThinkingLevel', () => {
  const defaults = {
    globalDefault: 'low',
    modeDefaults: { plan: 'high' },
  } satisfies Parameters<typeof resolveDefaultThinkingLevel>[0];

  it('uses the active mode default when present', () => {
    expect(resolveDefaultThinkingLevel(defaults, 'plan')).toEqual({ level: 'high', source: 'mode-default' });
  });

  it('falls back to the global default', () => {
    expect(resolveDefaultThinkingLevel(defaults, 'build')).toEqual({ level: 'low', source: 'global' });
  });
});
