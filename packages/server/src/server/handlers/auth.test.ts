import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { GET_AUTH_CAPABILITIES_ROUTE } from './auth';

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
