import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { ApiConfigProvider, useApiConfig } from '../config';

const BASE_URL = 'http://localhost:4111';

describe('ApiConfigProvider', () => {
  describe('when a hook reads the config', () => {
    it('exposes the injected base url and a client that hits it', async () => {
      server.use(http.get(`${BASE_URL}/api/web/config/providers`, () => HttpResponse.json({ providers: [] })));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ApiConfigProvider baseUrl={BASE_URL}>{children}</ApiConfigProvider>
      );
      const { result } = renderHook(() => useApiConfig(), { wrapper });

      expect(result.current.baseUrl).toBe(BASE_URL);
      const body = await result.current.client.get<{ providers: unknown[] }>('/api/web/config/providers');
      expect(body.providers).toEqual([]);
    });
  });

  describe('when used outside the provider', () => {
    it('throws a helpful error', () => {
      expect(() => renderHook(() => useApiConfig())).toThrow(/ApiConfigProvider/);
    });
  });
});
