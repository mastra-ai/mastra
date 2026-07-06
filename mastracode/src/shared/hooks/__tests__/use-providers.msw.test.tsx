import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useProvidersQuery, useRemoveProviderKey, useSaveProviderKey } from '../use-providers';
import { anthropicProviderNoKey, openaiProvider, providersResponse } from './fixtures/providers';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;

describe('useProvidersQuery', () => {
  describe('when the providers list loads', () => {
    it('returns the providers from the server', async () => {
      server.use(http.get(PROVIDERS_URL, () => HttpResponse.json(providersResponse)));

      const { result } = renderHookWithProviders(() => useProvidersQuery());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([openaiProvider, anthropicProviderNoKey]);
    });
  });

  describe('when the providers request fails', () => {
    it('surfaces the server error message', async () => {
      server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      const { result } = renderHookWithProviders(() => useProvidersQuery());

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('boom');
    });
  });
});

describe('useSaveProviderKey', () => {
  describe('when a key is saved', () => {
    it('PUTs the key and invalidates the providers query so it refetches', async () => {
      let putBody: unknown;
      let getCalls = 0;
      server.use(
        http.get(PROVIDERS_URL, () => {
          getCalls += 1;
          // First load: openai not yet configured. After save: configured.
          const providers =
            getCalls === 1
              ? [{ provider: 'openai', source: 'none' }, anthropicProviderNoKey]
              : [openaiProvider, anthropicProviderNoKey];
          return HttpResponse.json({ providers });
        }),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true, provider: openaiProvider });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useProvidersQuery(),
        save: useSaveProviderKey(),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      expect(result.current.query.data?.[0]?.source).toBe('none');

      await act(async () => {
        await result.current.save.mutateAsync({ provider: 'openai', key: 'sk-test' });
      });
      await waitForMutationsIdle(client);

      expect(putBody).toEqual({ key: 'sk-test' });
      await waitFor(() => expect(result.current.query.data?.[0]?.source).toBe('stored'));
    });
  });
});

describe('useRemoveProviderKey', () => {
  describe('when a key is removed', () => {
    it('DELETEs the key and invalidates the providers query', async () => {
      let deleted = false;
      server.use(
        http.get(PROVIDERS_URL, () =>
          HttpResponse.json({
            providers: [deleted ? { provider: 'openai', source: 'none' } : openaiProvider],
          }),
        ),
        http.delete(keyUrl('openai'), () => {
          deleted = true;
          return HttpResponse.json({ ok: true, provider: { provider: 'openai', source: 'none' } });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useProvidersQuery(),
        remove: useRemoveProviderKey(),
      }));

      await waitFor(() => expect(result.current.query.data?.[0]?.source).toBe('stored'));

      await act(async () => {
        await result.current.remove.mutateAsync({ provider: 'openai' });
      });
      await waitForMutationsIdle(client);

      await waitFor(() => expect(result.current.query.data?.[0]?.source).toBe('none'));
    });
  });
});
