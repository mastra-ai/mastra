import type { Mastra } from '@mastra/core';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { describe, it, expect } from 'vitest';

import { buildProviderModelCatalog } from './provider-catalog';

type GatewayStub = {
  id: string;
  fetchProviders: () => Promise<Record<string, { name: string; models: string[] }>>;
};

function makeMastra(gateways?: Record<string, GatewayStub>): Mastra {
  return {
    listGateways: () => gateways,
  } as unknown as Mastra;
}

describe('buildProviderModelCatalog', () => {
  const [sampleProvider, sampleConfig] = Object.entries(PROVIDER_REGISTRY).find(
    ([, config]) => (config as { models: string[] }).models.length > 0,
  ) as [string, { models: string[] }];
  const sampleModel = sampleConfig.models[0]!;

  it('enumerates the static registry providers/models', async () => {
    const result = await buildProviderModelCatalog(makeMastra());
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContainEqual({ provider: sampleProvider, name: sampleModel });
  });

  it('merges gateway providers with the unified-id and prefixed-id rules', async () => {
    const result = await buildProviderModelCatalog(
      makeMastra({
        // providerId === gateway.id ⇒ unified, no prefix.
        unified: {
          id: 'unified',
          fetchProviders: async () => ({ unified: { name: 'Unified', models: ['u-1'] } }),
        },
        // providerId !== gateway.id ⇒ prefixed.
        netlify: {
          id: 'netlify',
          fetchProviders: async () => ({ acme: { name: 'Acme', models: ['acme-large'] } }),
        },
      }),
    );

    expect(result).toContainEqual({ provider: 'unified', name: 'u-1' });
    expect(result).toContainEqual({ provider: 'netlify/acme', name: 'acme-large' });
  });

  it('skips the models.dev gateway', async () => {
    const result = await buildProviderModelCatalog(
      makeMastra({
        'models.dev': {
          id: 'models.dev',
          fetchProviders: async () => ({ shadow: { name: 'Shadow', models: ['shadow-1'] } }),
        },
      }),
    );

    expect(result).not.toContainEqual({ provider: 'shadow', name: 'shadow-1' });
    expect(result).not.toContainEqual({ provider: 'models.dev/shadow', name: 'shadow-1' });
  });

  it('does not duplicate provider/model pairs already present in the registry', async () => {
    const result = await buildProviderModelCatalog(
      makeMastra({
        dup: {
          id: 'dup',
          fetchProviders: async () => ({ [sampleProvider]: { name: sampleProvider, models: [sampleModel] } }),
        },
      }),
    );

    const occurrences = result.filter(e => e.provider === sampleProvider && e.name === sampleModel);
    expect(occurrences).toHaveLength(1);
  });

  it('swallows a throwing gateway and still returns the registry catalog', async () => {
    const result = await buildProviderModelCatalog(
      makeMastra({
        broken: {
          id: 'broken',
          fetchProviders: async () => {
            throw new Error('gateway down');
          },
        },
      }),
    );

    expect(result).toContainEqual({ provider: sampleProvider, name: sampleModel });
  });
});
