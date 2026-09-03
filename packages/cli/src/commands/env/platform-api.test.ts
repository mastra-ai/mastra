import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTokenOrganizationId } from './platform-api.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('fetchTokenOrganizationId', () => {
  it('resolves the organization bound to an API key', async () => {
    vi.stubEnv('MASTRA_PLATFORM_API_URL', 'https://platform.example');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ organizationId: 'organization-1', authType: 'api-key' }));

    await expect(fetchTokenOrganizationId('sk_test')).resolves.toBe('organization-1');
    expect(fetchMock).toHaveBeenCalledWith('https://platform.example/v1/auth/verify', {
      headers: { Authorization: 'Bearer sk_test' },
    });
  });

  it('rejects a successful response without an organization', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ authType: 'api-key' }));

    await expect(fetchTokenOrganizationId('sk_test')).rejects.toThrow(
      'Platform credential verification did not return an organization ID.',
    );
  });
});
