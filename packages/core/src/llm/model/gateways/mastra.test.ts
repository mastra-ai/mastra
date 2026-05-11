import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraGateway } from './mastra.js';

describe('MastraGateway', () => {
  beforeEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
  });

  afterEach(() => {
    delete process.env.MASTRA_GATEWAY_API_KEY;
    vi.restoreAllMocks();
  });

  it('reports disabled when MASTRA_GATEWAY_API_KEY is not set', () => {
    const gateway = new MastraGateway();

    expect(gateway.shouldEnable()).toBe(false);
  });

  it('returns no providers when MASTRA_GATEWAY_API_KEY is not set', async () => {
    const gateway = new MastraGateway();

    const providers = await gateway.fetchProviders();

    expect(providers).toEqual({});
  });

  it('returns the mastra provider when MASTRA_GATEWAY_API_KEY is set', async () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'test-key';

    const gateway = new MastraGateway();

    expect(gateway.shouldEnable()).toBe(true);

    const providers = await gateway.fetchProviders();

    expect(providers.mastra).toBeDefined();
    expect(providers.mastra?.apiKeyEnvVar).toBe('MASTRA_GATEWAY_API_KEY');
  });
});
