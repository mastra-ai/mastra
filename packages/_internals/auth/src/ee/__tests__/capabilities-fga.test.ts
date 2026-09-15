/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { buildCapabilities } from '../capabilities';
import type { IFGAProvider } from '../interfaces/fga';
import { clearLicenseCache } from '../license';

// Minimal mock auth provider that implements IUserProvider
function createMockAuth(user: { id: string; email: string; name: string } | null = null) {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
  };
}

// Minimal mock FGA provider
function createMockFGAProvider(): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(true),
    require: vi.fn().mockResolvedValue(undefined),
    filterAccessible: vi.fn().mockImplementation((_u, resources) => Promise.resolve(resources)),
  };
}

describe('FGA Capability Detection', () => {
  let originalNodeEnv: string | undefined;
  let originalLicense: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    clearLicenseCache();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
    clearLicenseCache();
  });

  it('should include fga: true when FGA provider is configured and licensed', async () => {
    process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
    const auth = createMockAuth({ id: 'user-1', email: 'test@test.com', name: 'Test' });
    const fgaProvider = createMockFGAProvider();

    const result = await buildCapabilities(auth as any, new Request('http://localhost'), {
      fga: fgaProvider,
    });

    expect('capabilities' in result && result.capabilities.fga).toBe(true);
  });

  it('should include fga: false when no FGA provider configured', async () => {
    process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
    const auth = createMockAuth({ id: 'user-1', email: 'test@test.com', name: 'Test' });

    const result = await buildCapabilities(auth as any, new Request('http://localhost'));

    expect('capabilities' in result && result.capabilities.fga).toBe(false);
  });

  it('should include fga: false when FGA provider present but no license in production', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['MASTRA_EE_LICENSE'];
    const auth = createMockAuth({ id: 'user-1', email: 'test@test.com', name: 'Test' });
    const fgaProvider = createMockFGAProvider();

    const result = await buildCapabilities(auth as any, new Request('http://localhost'), {
      fga: fgaProvider,
    });

    expect(result).toEqual({ enabled: true, login: null });
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('should include fga: true in dev environments without license', async () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['MASTRA_EE_LICENSE'];
    const auth = createMockAuth({ id: 'user-1', email: 'test@test.com', name: 'Test' });
    const fgaProvider = createMockFGAProvider();

    const result = await buildCapabilities(auth as any, new Request('http://localhost'), {
      fga: fgaProvider,
    });

    expect('capabilities' in result && result.capabilities.fga).toBe(true);
  });
});
