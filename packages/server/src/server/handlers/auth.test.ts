import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { GET_AUTH_CAPABILITIES_ROUTE, getPublicOrigin } from './auth';

describe('Auth Handlers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getPublicOrigin', () => {
    it('returns origin from x-forwarded-host when present', () => {
      const request = new Request('http://internal:3000/api/auth/sso/login', {
        headers: { 'X-Forwarded-Host': 'app.example.com' },
      });
      expect(getPublicOrigin(request)).toBe('https://app.example.com');
    });

    it('uses only the first value from a multi-value x-forwarded-host', () => {
      const request = new Request('http://internal:3000/api/auth/sso/login', {
        headers: {
          'X-Forwarded-Host': 'my-project.studio.mastra.cloud, 3000-abc123.daytonaproxy01.net',
        },
      });
      expect(getPublicOrigin(request)).toBe('https://my-project.studio.mastra.cloud');
    });

    it('falls back to request.url origin when x-forwarded-host is absent', () => {
      const request = new Request('http://localhost:3000/api/auth/sso/login');
      expect(getPublicOrigin(request)).toBe('http://localhost:3000');
    });
  });

  describe('GET_AUTH_CAPABILITIES_ROUTE', () => {
    it('should return enabled: false when x-mastra-dev-playground header is set in dev mode', async () => {
      // This is the regression test: in dev playground mode, the UI should not show auth gates
      process.env.MASTRA_DEV = 'true';

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

      expect(result).toEqual({ enabled: false, login: null });
    });
  });
});
