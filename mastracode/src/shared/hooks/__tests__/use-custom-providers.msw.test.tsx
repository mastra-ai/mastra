import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useCustomProvidersQuery, useRemoveCustomProvider, useSaveCustomProvider } from '../use-custom-providers';
import { customProvider, customProvidersResponse } from './fixtures/custom-providers';

const URL = `${TEST_BASE_URL}/api/web/config/custom-providers`;

describe('useCustomProvidersQuery', () => {
  describe('when the list loads', () => {
    it('returns the custom providers', async () => {
      server.use(http.get(URL, () => HttpResponse.json(customProvidersResponse)));

      const { result } = renderHookWithProviders(() => useCustomProvidersQuery());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([customProvider]);
    });
  });
});

describe('useSaveCustomProvider', () => {
  describe('when a provider is created', () => {
    it('POSTs the body and invalidates the list so it refetches', async () => {
      let postBody: unknown;
      let getCalls = 0;
      server.use(
        http.get(URL, () => {
          getCalls += 1;
          return HttpResponse.json({ providers: getCalls === 1 ? [] : [customProvider] });
        }),
        http.post(URL, async ({ request }) => {
          postBody = await request.json();
          return HttpResponse.json({ ok: true, provider: customProvider });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useCustomProvidersQuery(),
        save: useSaveCustomProvider(),
      }));

      await waitFor(() => expect(result.current.query.data).toEqual([]));

      await act(async () => {
        await result.current.save.mutateAsync({
          name: 'My LLM',
          url: 'https://api.my-llm.test/v1',
          apiKey: 'sk-x',
          models: ['my-llm/fast'],
        });
      });
      await waitForMutationsIdle(client);

      expect(postBody).toEqual({
        name: 'My LLM',
        url: 'https://api.my-llm.test/v1',
        apiKey: 'sk-x',
        models: ['my-llm/fast'],
      });
      await waitFor(() => expect(result.current.query.data).toEqual([customProvider]));
    });

    it('includes previousId when editing', async () => {
      let postBody: Record<string, unknown> | undefined;
      server.use(
        http.get(URL, () => HttpResponse.json({ providers: [customProvider] })),
        http.post(URL, async ({ request }) => {
          postBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ok: true, provider: customProvider });
        }),
      );

      const { result, client } = renderHookWithProviders(() => useSaveCustomProvider());

      await act(async () => {
        await result.current.mutateAsync({
          name: 'My LLM',
          url: 'https://api.my-llm.test/v1',
          models: ['my-llm/fast'],
          previousId: 'old-id',
        });
      });
      await waitForMutationsIdle(client);

      expect(postBody?.previousId).toBe('old-id');
    });
  });
});

describe('useRemoveCustomProvider', () => {
  describe('when a provider is removed', () => {
    it('DELETEs by id and invalidates the list', async () => {
      let removed = false;
      server.use(
        http.get(URL, () => HttpResponse.json({ providers: removed ? [] : [customProvider] })),
        http.delete(`${URL}/${encodeURIComponent('my-llm')}`, () => {
          removed = true;
          return HttpResponse.json({ ok: true });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useCustomProvidersQuery(),
        remove: useRemoveCustomProvider(),
      }));

      await waitFor(() => expect(result.current.query.data).toEqual([customProvider]));

      await act(async () => {
        await result.current.remove.mutateAsync({ id: 'my-llm' });
      });
      await waitForMutationsIdle(client);

      await waitFor(() => expect(result.current.query.data).toEqual([]));
    });
  });
});
