import { describe, expect, it } from 'vitest';
import { ModelRouterLanguageModel } from './router.js';

describe('ModelRouterLanguageModel - serializeForSpan', () => {
  it('returns only non-sensitive identity fields', () => {
    const model = new ModelRouterLanguageModel({
      providerId: 'openai',
      modelId: 'gpt-4o',
      url: 'https://proxy.internal.example.com/v1',
      apiKey: 'sk-super-secret',
      headers: { Authorization: 'Bearer internal-token', 'X-Gateway-Key': 'gateway-secret' },
    });

    const serialized = model.serializeForSpan();

    expect(serialized).toEqual({
      specificationVersion: 'v2',
      modelId: 'gpt-4o',
      provider: 'openai',
      gatewayId: expect.any(String),
    });
  });

  it('does not expose apiKey, headers, url, or gateway on the serialized form', () => {
    const model = new ModelRouterLanguageModel({
      providerId: 'openai',
      modelId: 'gpt-4o',
      url: 'https://proxy.internal.example.com/v1',
      apiKey: 'sk-super-secret',
      headers: { Authorization: 'Bearer internal-token' },
    });

    const serialized = JSON.stringify(model.serializeForSpan());

    expect(serialized).not.toContain('sk-super-secret');
    expect(serialized).not.toContain('internal-token');
    expect(serialized).not.toContain('proxy.internal.example.com');
    expect(serialized).not.toMatch(/"gateway"\s*:/);
    expect(serialized).not.toMatch(/"config"\s*:/);
    expect(serialized).not.toMatch(/"apiKey"\s*:/);
    expect(serialized).not.toMatch(/"headers"\s*:/);
  });
});
