import { describe, expect, it } from 'vitest';
import { AzureOpenAIGateway } from './azure.js';
import { MastraGateway } from './mastra.js';
import { ModelsDevGateway } from './models-dev.js';
import { NetlifyGateway } from './netlify.js';

describe('Gateway serializeForSpan', () => {
  it('MastraGateway does not leak config (apiKey, baseUrl, customFetch)', () => {
    const gateway = new MastraGateway({
      apiKey: 'sk-mastra-secret',
      baseUrl: 'https://internal.gateway.example.com',
      customFetch: (async () => new Response()) as typeof globalThis.fetch,
    });

    const serialized = gateway.serializeForSpan();

    expect(serialized).toEqual({ id: 'mastra', name: 'Memory Gateway' });
    expect(JSON.stringify(serialized)).not.toContain('sk-mastra-secret');
    expect(JSON.stringify(serialized)).not.toContain('internal.gateway.example.com');
  });

  it('NetlifyGateway does not leak tokenCache', () => {
    const gateway = new NetlifyGateway();

    const serialized = gateway.serializeForSpan();

    expect(serialized).toEqual({ id: 'netlify', name: 'Netlify AI Gateway' });
    expect(serialized).not.toHaveProperty('tokenCache');
  });

  it('ModelsDevGateway does not leak providerConfigs', () => {
    const gateway = new ModelsDevGateway({
      openai: {
        apiKeyEnvVar: 'OPENAI_API_KEY',
        name: 'OpenAI',
        models: [],
        gateway: 'models.dev',
      },
    });

    const serialized = gateway.serializeForSpan();

    expect(serialized).toEqual({ id: 'models.dev', name: 'models.dev' });
    expect(serialized).not.toHaveProperty('providerConfigs');
  });

  it('AzureOpenAIGateway does not leak config (apiKey, management credentials)', () => {
    const gateway = new AzureOpenAIGateway({
      resourceName: 'my-resource',
      apiKey: 'azure-secret-key',
      deployments: ['gpt-4o'],
    });

    const serialized = gateway.serializeForSpan();

    expect(serialized).toEqual({ id: 'azure-openai', name: 'azure-openai' });
    expect(JSON.stringify(serialized)).not.toContain('azure-secret-key');
    expect(JSON.stringify(serialized)).not.toContain('my-resource');
  });
});
