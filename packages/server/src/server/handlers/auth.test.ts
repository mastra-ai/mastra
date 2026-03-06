import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { GET_AUTH_CAPABILITIES_ROUTE } from './auth';

// Mock the EE buildCapabilities so we can verify the real capabilities path
vi.mock('@mastra/core/auth/ee', () => ({
  buildCapabilities: vi.fn().mockResolvedValue({
    enabled: true,
    login: { type: 'sso' },
    user: null,
  }),
}));

describe('Auth Handlers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET_AUTH_CAPABILITIES_ROUTE', () => {
    it('should return enabled: false when no auth provider is configured', async () => {
      const mockMastra = {
        getServer: () => ({
          auth: {
            // No authenticateToken — not a provider
            protected: ['/api/*'],
          },
        }),
      };

      const mockRequest = {
        headers: new Headers(),
      };

      const result = await GET_AUTH_CAPABILITIES_ROUTE.handler({
        mastra: mockMastra,
        request: mockRequest,
      } as any);

      expect(result).toEqual({ enabled: false, login: null });
    });

    it('should return real capabilities when auth provider is configured', async () => {
      const mockMastra = {
        getServer: () => ({
          auth: {
            authenticateToken: vi.fn(),
            protected: ['/api/*'],
          },
        }),
      };

      const mockRequest = {
        headers: new Headers({
          'x-mastra-dev-playground': 'true',
        }),
      };

      const result = await GET_AUTH_CAPABILITIES_ROUTE.handler({
        mastra: mockMastra,
        request: mockRequest,
      } as any);

      expect(result).toEqual({
        enabled: true,
        login: { type: 'sso' },
        user: null,
      });
    });
  });
});
