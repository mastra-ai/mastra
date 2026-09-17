import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildProvidersList, isProviderConnected } from './agents';
import { buildProvidersList as buildCatalog } from './provider-catalog';

afterEach(() => vi.unstubAllEnvs());

describe('provider helper compatibility', () => {
  it('preserves the original catalog export', () => {
    expect(buildProvidersList).toBe(buildCatalog);
  });

  it('keeps the synchronous environment check and SDK provider suffixes', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(isProviderConnected('openai.responses')).toBe(false);
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    expect(isProviderConnected('openai.responses')).toBe(true);
  });

  it('requires every distinct custom-provider credential through the gateway-prefix lookup', () => {
    const providers = {
      'acme/service': {
        name: 'Service',
        models: ['model'],
        gateway: 'acme',
        apiKeyEnvVar: ['SERVICE_KEY', 'SERVICE_ID'],
      },
    };
    vi.stubEnv('SERVICE_KEY', 'key');
    vi.stubEnv('SERVICE_ID', '');
    expect(isProviderConnected('service', providers)).toBe(false);
    vi.stubEnv('SERVICE_ID', 'id');
    expect(isProviderConnected('service', providers)).toBe(true);
  });
});
