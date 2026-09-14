import type * as CoreLlm from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, expect, it, vi } from 'vitest';
import { GET_PROVIDERS_ROUTE } from './agents';
import { createTestServerContext } from './test-utils';

vi.mock('@mastra/core/llm', async importOriginal => {
  const { GatewayManager: _, ...olderCore } = await importOriginal<typeof CoreLlm>();
  return olderCore;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it('keeps provider status available with core versions that predate GatewayManager', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'configured-key');
  vi.stubEnv('ANTHROPIC_API_KEY', undefined);

  const result = await GET_PROVIDERS_ROUTE.handler(createTestServerContext({ mastra: new Mastra({}) }));

  expect(result.providers.find(provider => provider.id === 'openai')?.connected).toBe(true);
  expect(result.providers.find(provider => provider.id === 'anthropic')?.connected).toBe(false);
});
