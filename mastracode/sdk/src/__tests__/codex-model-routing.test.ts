import { describe, expect, it } from 'vitest';

import { remapOpenAIModelForCodexOAuth } from '../agents/model.js';
import { getEffectiveThinkingLevel, supportsMaxReasoningEffort } from '../providers/openai-codex.js';

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

  it('preserves requested level for non-GPT-5 models', () => {
    expect(getEffectiveThinkingLevel('gpt-4.1', 'off')).toBe('off');
    expect(getEffectiveThinkingLevel('gpt-4.1', 'high')).toBe('high');
  });

  it('preserves max for GPT-5.6+ models that support it', () => {
    expect(getEffectiveThinkingLevel('gpt-5.6', 'max')).toBe('max');
    expect(getEffectiveThinkingLevel('gpt-5.6-codex', 'max')).toBe('max');
    expect(getEffectiveThinkingLevel('gpt-6', 'max')).toBe('max');
  });

  it('clamps max to xhigh for models whose effort scale tops out there', () => {
    expect(getEffectiveThinkingLevel('gpt-5.3-codex', 'max')).toBe('xhigh');
    expect(getEffectiveThinkingLevel('gpt-5.1-codex-mini', 'max')).toBe('xhigh');
    expect(getEffectiveThinkingLevel('gpt-4.1', 'max')).toBe('xhigh');
  });
});

describe('supportsMaxReasoningEffort', () => {
  it('is true from gpt-5.6 upward and false below', () => {
    expect(supportsMaxReasoningEffort('gpt-5.6')).toBe(true);
    expect(supportsMaxReasoningEffort('gpt-5.6-sol')).toBe(true);
    expect(supportsMaxReasoningEffort('gpt-6')).toBe(true);
    expect(supportsMaxReasoningEffort('gpt-5.5')).toBe(false);
    expect(supportsMaxReasoningEffort('gpt-5')).toBe(false);
    expect(supportsMaxReasoningEffort('gpt-4.1')).toBe(false);
    expect(supportsMaxReasoningEffort('o3')).toBe(false);
  });
});
