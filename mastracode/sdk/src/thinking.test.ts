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
