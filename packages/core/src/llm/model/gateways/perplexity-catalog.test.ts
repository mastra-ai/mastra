import { describe, expect, it } from 'vitest';
import { normalizePerplexityCatalog } from './perplexity-catalog.js';

describe('Perplexity Agent model choices', () => {
  it('replaces retired direct Sonar choices with current Agent models while preserving their capabilities', () => {
    const providers = {
      perplexity: {
        id: 'perplexity',
        name: 'Perplexity',
        npm: '@ai-sdk/perplexity',
        env: ['PERPLEXITY_API_KEY'],
        models: {
          sonar: { id: 'sonar', status: 'deprecated', attachment: true },
          'sonar-pro': { id: 'sonar-pro', status: 'deprecated' },
          'sonar-reasoning': { id: 'sonar-reasoning' },
          'sonar-reasoning-pro': { id: 'sonar-reasoning-pro' },
          'sonar-deep-research': { id: 'sonar-deep-research' },
        },
      },
      'perplexity-agent': {
        id: 'perplexity-agent',
        name: 'Perplexity Agent',
        npm: '@ai-sdk/openai',
        api: 'https://api.perplexity.ai/v1',
        doc: 'https://docs.perplexity.ai/docs/agent-api/models',
        env: ['PERPLEXITY_API_KEY'],
        models: {
          'openai/gpt-5.5': {
            id: 'openai/gpt-5.5',
            attachment: true,
            temperature: false,
            release_date: '2026-04-23',
            reasoning_options: [
              { type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
              { type: 'toggle' },
              { type: 'budget_tokens', min: 1024 },
            ],
          },
          'perplexity/sonar': { id: 'perplexity/sonar', temperature: true },
        },
      },
      openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        npm: '@openrouter/ai-sdk-provider',
        env: ['OPENROUTER_API_KEY'],
        models: { 'perplexity/sonar-pro': { id: 'perplexity/sonar-pro' } },
      },
    };

    const result = normalizePerplexityCatalog(providers);
    expect(Object.keys(result.perplexity.models).sort()).toEqual([
      'fast',
      'high',
      'low',
      'medium',
      'openai/gpt-5.5',
      'perplexity/sonar',
      'xhigh',
    ]);
    expect(result.perplexity).toMatchObject({
      id: 'perplexity',
      name: 'Perplexity',
      api: 'https://api.perplexity.ai',
      npm: '@ai-sdk/perplexity',
      env: ['PERPLEXITY_API_KEY'],
      doc: 'https://docs.perplexity.ai/docs/agent-api/models',
    });
    expect(result.perplexity.models).toHaveProperty(['openai/gpt-5.5'], {
      id: 'openai/gpt-5.5',
      attachment: true,
      temperature: false,
      release_date: '2026-04-23',
      reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh'] }],
    });
    expect(result['perplexity-agent']).toMatchObject({
      id: 'perplexity-agent',
      name: 'Perplexity Agent',
      api: 'https://api.perplexity.ai',
      npm: '@ai-sdk/perplexity',
      models: result.perplexity.models,
    });
    expect(result.openrouter).toBe(providers.openrouter);
    expect(providers.perplexity.models).toHaveProperty('sonar-pro');
  });

  it('offers documented Agent choices when models.dev only supplies its stale Sonar row', () => {
    const result = normalizePerplexityCatalog({
      perplexity: {
        id: 'perplexity',
        name: 'Perplexity',
        models: { 'sonar-pro': { id: 'sonar-pro' } },
      },
    });
    expect(Object.keys(result.perplexity.models).sort()).toEqual([
      'fast',
      'high',
      'low',
      'medium',
      'perplexity/sonar',
      'xhigh',
    ]);
    for (const model of Object.values(result.perplexity.models)) {
      expect(model).not.toHaveProperty('reasoning_options');
      expect(model).not.toHaveProperty('attachment');
      expect(model).not.toHaveProperty('temperature');
    }
    expect(result['perplexity-agent'].models).toEqual(result.perplexity.models);
  });

  it('retains newly published canonical Agent models and does not restore old Sonar choices after repeated refreshes', () => {
    const input = {
      perplexity: {
        id: 'perplexity',
        name: 'Perplexity',
        models: {
          'sonar-pro': { id: 'sonar-pro' },
          'openai/gpt-5.5': { id: 'openai/gpt-5.5', temperature: false },
        },
      },
      'perplexity-agent': {
        id: 'perplexity-agent',
        name: 'Perplexity Agent',
        models: {
          'openai/gpt-5.5': { id: 'openai/gpt-5.5', temperature: true },
        },
      },
    };
    const once = normalizePerplexityCatalog(input);
    const twice = normalizePerplexityCatalog(once);
    expect(twice).toEqual(once);
    expect(twice.perplexity.models['openai/gpt-5.5']).toMatchObject({ temperature: false });
    expect(twice.perplexity.models).not.toHaveProperty('sonar-pro');
  });

  it('does not add a provider when the catalog has no Perplexity data', () => {
    const input = { local: { id: 'local', name: 'Local', models: { model: { id: 'model' } } } };
    expect(normalizePerplexityCatalog(input)).toBe(input);
  });
});
