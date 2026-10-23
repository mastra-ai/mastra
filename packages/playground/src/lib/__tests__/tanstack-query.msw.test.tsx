import { MastraClient } from '@mastra/client-js';
import { useQueryClient } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { PlaygroundQueryClient } from '../tanstack-query';
import { systemPackages } from './fixtures/tanstack-query';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

afterEach(() => cleanup());

describe('PlaygroundQueryClient', () => {
  describe('when the provider rerenders after fetching a query', () => {
    it('preserves the cached response', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)));

      const client = new MastraClient({ baseUrl: BASE_URL });
      const { result, rerender } = renderHook(() => useQueryClient(), { wrapper: PlaygroundQueryClient });

      await result.current.fetchQuery({
        queryKey: ['system-packages'],
        queryFn: () => client.getSystemPackages(),
      });

      rerender();

      expect(result.current.getQueryData(['system-packages'])).toEqual(systemPackages);
    });
  });
});
