import { describe, expect, it } from 'vitest';

import { remapOpenAIModelForCodexOAuth } from '../agents/model.js';
import { resolveCodexThinkingLevel, supportsMaxReasoningEffort } from '../providers/openai-codex.js';
import { resolveThinkingLevelForModel } from '../thinking.js';

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

describe('resolveCodexThinkingLevel', () => {
  it('enforces low minimum for GPT-5 models when requested level is off', () => {
    expect(resolveCodexThinkingLevel('gpt-5.3-codex', 'off')).toBe('low');
    expect(resolveCodexThinkingLevel('gpt-5.1-codex-mini', 'off')).toBe('low');
  });

  it('leaves off alone outside Codex, where it omits the reasoning effort', () => {
    expect(resolveThinkingLevelForModel('gpt-5.3-codex', 'off')).toBe('off');
  });

  it('runs models without reasoning at off whatever level was picked', () => {
    expect(resolveCodexThinkingLevel('gpt-4.1', 'off')).toBe('off');
    expect(resolveCodexThinkingLevel('gpt-4.1', 'high')).toBe('off');
  });

  it('preserves max for GPT-5.6+ models that support it', () => {
    expect(resolveCodexThinkingLevel('gpt-5.6', 'max')).toBe('max');
    expect(resolveCodexThinkingLevel('gpt-5.6-codex', 'max')).toBe('max');
    expect(resolveCodexThinkingLevel('gpt-6', 'max')).toBe('max');
  });

  it('clamps to the top of each model’s effort scale', () => {
    expect(resolveCodexThinkingLevel('gpt-5.3-codex', 'max')).toBe('xhigh');
    expect(resolveCodexThinkingLevel('gpt-5.1-codex-max', 'max')).toBe('xhigh');
    expect(resolveCodexThinkingLevel('gpt-5.1-codex-mini', 'max')).toBe('high');
    expect(resolveCodexThinkingLevel('gpt-5', 'xhigh')).toBe('high');
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
