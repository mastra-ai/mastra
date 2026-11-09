import { getModelReasoningOptions } from '@mastra/core/llm';
import type * as CoreLlm from '@mastra/core/llm';
import { describe, expect, it, vi } from 'vitest';

import { remapOpenAIModelForCodexOAuth } from '../agents/model.js';
import { getEffectiveThinkingLevel } from '../providers/openai-codex.js';

vi.mock('@mastra/core/llm', async importOriginal => {
  const actual = await importOriginal<typeof CoreLlm>();
  return { ...actual, getModelReasoningOptions: vi.fn(actual.getModelReasoningOptions) };
});

describe('remapOpenAIModelForCodexOAuth', () => {
  it('maps only explicit GPT-5 models to codex variants for OAuth', () => {
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.3')).toBe('openai/gpt-5.3-codex');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.2')).toBe('openai/gpt-5.2-codex');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.1')).toBe('openai/gpt-5.1-codex');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.1-mini')).toBe('openai/gpt-5.1-codex-mini');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5')).toBe('openai/gpt-5-codex');
  });

  it('keeps codex and non-compatible models unchanged', () => {
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.3-codex')).toBe('openai/gpt-5.3-codex');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.1-codex-mini')).toBe('openai/gpt-5.1-codex-mini');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5.4')).toBe('openai/gpt-5.4');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5-mini')).toBe('openai/gpt-5-mini');
    expect(remapOpenAIModelForCodexOAuth('openai/gpt-5-nano')).toBe('openai/gpt-5-nano');
    expect(remapOpenAIModelForCodexOAuth('anthropic/claude-sonnet-4-5')).toBe('anthropic/claude-sonnet-4-5');
  });

  it('preserves the mastra gateway prefix when remapping GPT-5 models', () => {
    expect(remapOpenAIModelForCodexOAuth('mastra/openai/gpt-5')).toBe('mastra/openai/gpt-5-codex');
    expect(remapOpenAIModelForCodexOAuth('mastra/openai/gpt-5.3')).toBe('mastra/openai/gpt-5.3-codex');
    expect(remapOpenAIModelForCodexOAuth('mastra/openai/gpt-5.4-mini')).toBe('mastra/openai/gpt-5.4-mini');
    expect(remapOpenAIModelForCodexOAuth('mastra/anthropic/claude-sonnet-4-5')).toBe(
      'mastra/anthropic/claude-sonnet-4-5',
    );
  });
});

describe('getEffectiveThinkingLevel', () => {
  it('enforces low minimum for GPT-5 models when requested level is off', () => {
    expect(getEffectiveThinkingLevel('gpt-5.3-codex', 'off')).toBe('low');
    expect(getEffectiveThinkingLevel('gpt-5.1-codex-mini', 'off')).toBe('low');
  });

  it('raises off to the lowest effort a GPT-5 model publishes', () => {
    vi.mocked(getModelReasoningOptions).mockReturnValueOnce([{ type: 'effort', values: ['high'] }]);
    expect(getEffectiveThinkingLevel('gpt-5-pro', 'off')).toBe('high');
  });

  it('keeps off and published efforts for non-GPT-5 reasoning models', () => {
    expect(getEffectiveThinkingLevel('o3', 'off')).toBe('off');
    expect(getEffectiveThinkingLevel('o3', 'high')).toBe('high');
  });

  it('preserves max for GPT-5.6+ models that support it', () => {
    expect(getEffectiveThinkingLevel('gpt-5.6', 'max')).toBe('max');
    expect(getEffectiveThinkingLevel('gpt-5.6-codex', 'max')).toBe('max');
    expect(getEffectiveThinkingLevel('gpt-6', 'max')).toBe('max');
  });

  it('clamps max to xhigh for models whose effort scale tops out there', () => {
    expect(getEffectiveThinkingLevel('gpt-5.3-codex', 'max')).toBe('xhigh');
    expect(getEffectiveThinkingLevel('gpt-5.1-codex-mini', 'max')).toBe('xhigh');
  });
});
