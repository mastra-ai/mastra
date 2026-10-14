import { describe, expect, it } from 'vitest';
import { getCredentialProviderId, normalizeLegacyModelId } from '../model-ids.js';

describe('normalizeLegacyModelId', () => {
  it.each([
    ['mastracode/kimi-for-coding/k3', 'kimi-code-plan-cn/k3'],
    ['kimi-for-coding/kimi-for-coding-highspeed', 'kimi-code-plan-cn/kimi-for-coding-highspeed'],
    ['mastracode/github-copilot/gpt-4.1', 'github-copilot/gpt-4.1'],
    ['mastracode/amazon-bedrock/anthropic.claude-sonnet-4', 'amazon-bedrock/anthropic.claude-sonnet-4'],
  ])('maps the saved id %s to %s', (saved, current) => {
    expect(normalizeLegacyModelId(saved)).toBe(current);
  });

  it.each([
    'kimi-code-plan-cn/k3',
    'kimi-code-plan-global/k3',
    'github-copilot/gpt-4.1',
    'mastracode/acme-models/reasoner-v1',
    'mastra/anthropic/claude-sonnet-4-5',
    'openrouter/moonshotai/kimi-k2',
    'kimi-for-coding',
  ])('leaves %s unchanged', modelId => {
    expect(normalizeLegacyModelId(modelId)).toBe(modelId);
  });
});

describe('getCredentialProviderId', () => {
  it('authenticates the models.dev Kimi provider with the Kimi For Coding login', () => {
    expect(getCredentialProviderId('kimi-code-plan-cn')).toBe('kimi-for-coding');
    expect(getCredentialProviderId('kimi-code-plan-global')).toBe('kimi-code-plan-global');
    expect(getCredentialProviderId('openai')).toBe('openai-codex');
    expect(getCredentialProviderId('github-copilot')).toBe('github-copilot');
  });
});
