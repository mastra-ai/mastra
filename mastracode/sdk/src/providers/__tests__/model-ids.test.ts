import { describe, expect, it } from 'vitest';
import { getCatalogThinkingLevels } from '../../thinking-catalog.js';
import {
  getCredentialProviderId,
  normalizeLegacyModelId,
  parseCodexModelSelection,
  withCodexFastModels,
} from '../model-ids.js';

describe('parseCodexModelSelection', () => {
  it.each(['openai/gpt-6.2-sol', 'mastra/openai/gpt-6.2-astra'])('keeps the canonical model %s', modelId => {
    expect(parseCodexModelSelection(`${modelId}:fast`)).toEqual({ modelId, codexServiceTier: 'fast' });
    expect(getCatalogThinkingLevels(`${modelId}:fast`)).toEqual(getCatalogThinkingLevels(modelId));
  });

  it.each([
    'openrouter/openai/gpt-6.2-sol:fast',
    'anthropic/claude:fast',
    'openai/gpt-6.2-sol:FAST',
    'openai-proxy/gpt-6.2-sol:fast',
    'acme/local:fast',
  ])('does not reserve the suffix for %s', modelId => expect(parseCodexModelSelection(modelId)).toEqual({ modelId }));

  it.each(['openai/gpt-5.3', 'openai/gpt-5.4-mini', 'mastra/openai/gpt-4.1'])(
    'drops the suffix without requesting Fast on %s, which has no Fast tier',
    modelId => expect(parseCodexModelSelection(`${modelId}:fast`)).toEqual({ modelId }),
  );
});

describe('withCodexFastModels', () => {
  const model = (id: string, hasApiKey = true) => {
    const [provider, modelName] = id.split('/') as [string, string];
    return { id, provider, modelName, hasApiKey };
  };

  it('lists a Fast entry right after each connected OpenAI model that supports it', () => {
    const models = [model('anthropic/claude-fable-5'), model('openai/gpt-6.2-sol'), model('openai/gpt-5.3')];

    expect(withCodexFastModels(models, { codexOAuth: true }).map(m => m.id)).toEqual([
      'anthropic/claude-fable-5',
      'openai/gpt-6.2-sol',
      'openai/gpt-6.2-sol:fast',
      'openai/gpt-5.3',
    ]);
    expect(withCodexFastModels(models, { codexOAuth: true })[2]).toEqual({
      ...model('openai/gpt-6.2-sol'),
      id: 'openai/gpt-6.2-sol:fast',
      modelName: 'gpt-6.2-sol:fast',
    });
  });

  it('lists no Fast entries without Codex sign-in, where Fast has no effect', () => {
    const models = [model('openai/gpt-6.2-sol'), model('openai/gpt-6.2-sol:fast')];

    expect(withCodexFastModels(models, { codexOAuth: false }).map(m => m.id)).toEqual(['openai/gpt-6.2-sol']);
  });

  it('skips models that are not connected and never lists a Fast entry twice', () => {
    const models = [model('openai/gpt-6.1-sol', false), model('openai/gpt-6.2-sol'), model('openai/gpt-6.2-sol:fast')];

    expect(withCodexFastModels(models, { codexOAuth: true }).map(m => m.id)).toEqual([
      'openai/gpt-6.1-sol',
      'openai/gpt-6.2-sol',
      'openai/gpt-6.2-sol:fast',
    ]);
  });
});

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
