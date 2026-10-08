import { describe, expect, it } from 'vitest';

import {
  getAvailableThinkingLevelsForModel,
  parseThinkCommand,
  resolveDefaultThinkingLevel,
  runThinkingLevel,
  supportsMaxReasoningEffort,
} from './thinking.js';

const effort = (...values: string[]) => [{ type: 'effort' as const, values }];

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

  it.each([
    [
      'budget-era Claude drops max, which sends the xhigh budget',
      'anthropic/claude-haiku-4-5',
      undefined,
      ['off', 'low', 'medium', 'high', 'xhigh'],
    ],
    [
      'gateway-prefixed ids follow the routed provider',
      'mastra/anthropic/claude-haiku-4-5',
      undefined,
      ['off', 'low', 'medium', 'high', 'xhigh'],
    ],
    [
      'adaptive Claude offers the efforts the model publishes',
      'anthropic/claude-sonnet-4-6',
      effort('low', 'medium', 'high', 'max'),
      ['off', 'low', 'medium', 'high', 'max'],
    ],
    [
      'adaptive Claude without data drops xhigh before Opus 4.7',
      'anthropic/claude-opus-4-6',
      undefined,
      ['off', 'low', 'medium', 'high', 'max'],
    ],
    [
      'OpenAI offers the efforts the model publishes',
      'openai/gpt-5',
      effort('minimal', 'low', 'medium', 'high'),
      ['off', 'low', 'medium', 'high'],
    ],
    [
      'OpenAI without data drops max before GPT-5.6',
      'openai/gpt-5.5',
      undefined,
      ['off', 'low', 'medium', 'high', 'xhigh'],
    ],
    [
      'OpenAI without data keeps max from GPT-5.6',
      'openai/gpt-5.6-sol',
      undefined,
      ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
    ],
    [
      'Gemini 3 Pro has no medium whatever the data says',
      'google/gemini-3-pro-preview',
      effort('low', 'medium', 'high'),
      ['off', 'low', 'high'],
    ],
    ['Claude without extended thinking offers only off', 'anthropic/claude-3-5-haiku-20241022', undefined, ['off']],
    ['Gemini without a thinking config offers only off', 'google/gemini-2.0-flash', undefined, ['off']],
    [
      'other providers offer the efforts the model publishes',
      'xai/grok-3-mini',
      effort('low', 'high'),
      ['off', 'low', 'high'],
    ],
    ['OpenAI models listed without reasoning controls offer only off', 'openai/gpt-4o', [], ['off']],
    ['other providers listed without reasoning controls offer only off', 'xai/grok-4.20-0309-reasoning', [], ['off']],
    [
      'models that only toggle thinking offer off and one on level',
      'zai/glm-4.6',
      [{ type: 'toggle' }],
      ['off', 'high'],
    ],
    [
      'Claude keeps the levels its thinking budget sends when listed without controls',
      'anthropic/claude-haiku-4-5',
      [],
      ['off', 'low', 'medium', 'high', 'xhigh'],
    ],
    [
      'other providers without data keep every level',
      'xai/grok-3-mini',
      undefined,
      ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
    ],
    [
      'DeepSeek offers off through its thinking switch',
      'deepseek/deepseek-v4-pro',
      [{ type: 'toggle' }, ...effort('low', 'high', 'max')],
      ['off', 'low', 'high', 'max'],
    ],
    [
      'DeepSeek offers no off its request cannot send',
      'deepseek/deepseek-v4-pro',
      effort('none', 'high', 'max'),
      ['high', 'max'],
    ],
    [
      'DeepSeek offers only the efforts it runs distinctly',
      'deepseek/deepseek-v4-pro',
      [{ type: 'toggle' }, ...effort('low', 'medium', 'high', 'xhigh', 'max')],
      ['off', 'low', 'high', 'max'],
    ],
  ])('%s', (_, modelId, reasoningOptions, levels) => {
    expect(getAvailableThinkingLevelsForModel(modelId, reasoningOptions)).toEqual(levels);
  });

  it.each([
    ['max on budget-era Claude', 'anthropic/claude-haiku-4-5', 'max', undefined, 'xhigh'],
    [
      'xhigh on a model topping out at high',
      'anthropic/claude-sonnet-4-6',
      'xhigh',
      effort('low', 'medium', 'high', 'max'),
      'high',
    ],
    ['low on a model with only high', 'openai/gpt-5-pro', 'low', effort('high'), 'high'],
    ['off anywhere', 'openai/gpt-5-pro', 'off', effort('high'), 'off'],
    ['off on DeepSeek without its thinking switch', 'deepseek/deepseek-v4-pro', 'off', effort('none', 'high'), 'high'],
  ] as const)('runs %s as the closest level the request sends', (_, modelId, level, reasoningOptions, runLevel) => {
    expect(runThinkingLevel(modelId, level, reasoningOptions)).toBe(runLevel);
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
