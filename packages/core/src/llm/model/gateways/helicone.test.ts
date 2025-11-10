import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeliconeGateway } from './helicone.js';

describe('HeliconeGateway', () => {
  let gateway: HeliconeGateway;

  beforeEach(() => {
    gateway = new HeliconeGateway();
  });

  afterEach(() => {
    delete process.env.HELICONE_API_KEY;
  });

  it('fetchProviders returns a helicone config (network may be unavailable in CI)', async () => {
    const providers = await gateway.fetchProviders();
    expect(providers['helicone']).toBeDefined();
    expect(providers['helicone'].url).toBe('https://ai-gateway.helicone.ai');
    expect(providers['helicone'].apiKeyEnvVar).toBe('HELICONE_API_KEY');
  });

  it('buildUrl returns the Helicone base URL', () => {
    const url = gateway.buildUrl(undefined, process.env as any);
    expect(url).toBe('https://ai-gateway.helicone.ai');
  });

  it('getApiKey reads HELICONE_API_KEY and errors when missing', async () => {
    await expect(gateway.getApiKey('helicone/openai/gpt-4o')).rejects.toThrow('HELICONE_API_KEY');
    process.env.HELICONE_API_KEY = 'hk_test';
    await expect(gateway.getApiKey('helicone/openai/gpt-4o')).resolves.toBe('hk_test');
  });
});
