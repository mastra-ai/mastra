import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraGateway } from './gateways/mastra.js';
import { ModelRouterLanguageModel } from './router.js';

describe('Mastra Gateway memory ownership', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['msk_legacy', true],
    ['msk-gateway-current', false],
    ['msk-gateway-eu_current', false],
    ['mskv2_current', false],
  ])('resolves memory ownership for %s', async (key, expected) => {
    const model = new ModelRouterLanguageModel('mastra/openai/gpt-4o', [new MastraGateway({ apiKey: key })]);

    expect(await model.isGatewayMemoryManaged()).toBe(expected);
  });

  it('uses the explicit model key before the gateway key', async () => {
    const model = new ModelRouterLanguageModel({ id: 'mastra/openai/gpt-4o', apiKey: 'mskv2_current' }, [
      new MastraGateway({ apiKey: 'msk_legacy' }),
    ]);

    expect(await model.isGatewayMemoryManaged()).toBe(false);
  });

  it('uses the environment key for a mastra/ model string', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'mskv2_current');
    const model = new ModelRouterLanguageModel('mastra/openai/gpt-4o');

    expect(await model.isGatewayMemoryManaged()).toBe(false);
  });
});
