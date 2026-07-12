import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '#test/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '#test/render';

import {
  useCompleteProviderOAuth,
  useProvidersQuery,
  useRemoveProviderKey,
  useRemoveProviderOAuth,
  useSaveProviderKey,
  useStartProviderOAuth,
} from '../use-providers';
import { anthropicProviderNoKey, openaiProvider, providersResponse } from './fixtures/providers';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;
const oauthStartUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/start`;
const oauthCompleteUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/complete`;
const oauthUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth`;

describe('useProvidersQuery', () => {
  describe('when the providers list loads', () => {
    it('returns the providers from the server', async () => {
      server.use(http.get(PROVIDERS_URL, () => HttpResponse.json(providersResponse)));

      const { result } = renderHookWithProviders(() => useProvidersQuery());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(providersResponse);
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
          return HttpResponse.json({ credentialManagementEnabled: true, providers });
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
      expect(result.current.query.data?.providers[0]?.source).toBe('none');

      await act(async () => {
        await result.current.save.mutateAsync({ provider: 'openai', key: 'sk-test' });
      });
      await waitForMutationsIdle(client);

      expect(putBody).toEqual({ key: 'sk-test' });
      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('stored'));
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
            credentialManagementEnabled: true,
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

      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('stored'));

      await act(async () => {
        await result.current.remove.mutateAsync({ provider: 'openai' });
      });
      await waitForMutationsIdle(client);

      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('none'));
    });
  });
});

describe('useStartProviderOAuth', () => {
  describe('when an OAuth login is started', () => {
    it('POSTs to the provider OAuth start route', async () => {
      let started = false;
      server.use(
        http.post(oauthStartUrl('anthropic'), () => {
          started = true;
          return HttpResponse.json({ loginId: 'login-1', authUrl: 'https://claude.ai/oauth' });
        }),
      );

      const { result } = renderHookWithProviders(() => useStartProviderOAuth());

      const login = await result.current.mutateAsync({ provider: 'anthropic' });

      expect(started).toBe(true);
      expect(login).toEqual({ loginId: 'login-1', authUrl: 'https://claude.ai/oauth' });
    });
  });
});

describe('useCompleteProviderOAuth', () => {
  describe('when an OAuth login is completed', () => {
    it('POSTs the code and invalidates the providers query', async () => {
      let postBody: unknown;
      let getCalls = 0;
      server.use(
        http.get(PROVIDERS_URL, () => {
          getCalls += 1;
          return HttpResponse.json({
            credentialManagementEnabled: true,
            providers: [
              getCalls === 1
                ? { provider: 'anthropic', source: 'none', oauthSupported: true }
                : { provider: 'anthropic', source: 'oauth', oauthSupported: true },
            ],
          });
        }),
        http.post(oauthCompleteUrl('anthropic'), async ({ request }) => {
          postBody = await request.json();
          return HttpResponse.json({ ok: true, provider: { provider: 'anthropic', source: 'oauth' } });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useProvidersQuery(),
        complete: useCompleteProviderOAuth(),
      }));

      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('none'));

      await act(async () => {
        await result.current.complete.mutateAsync({ provider: 'anthropic', loginId: 'login-1', code: 'code-1' });
      });
      await waitForMutationsIdle(client);

      expect(postBody).toEqual({ loginId: 'login-1', code: 'code-1' });
      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('oauth'));
    });
  });
});

describe('useRemoveProviderOAuth', () => {
  describe('when OAuth credentials are removed', () => {
    it('DELETEs the OAuth route and invalidates the providers query', async () => {
      let deleted = false;
      server.use(
        http.get(PROVIDERS_URL, () =>
          HttpResponse.json({
            credentialManagementEnabled: true,
            providers: [{ provider: 'anthropic', source: deleted ? 'none' : 'oauth', oauthSupported: true }],
          }),
        ),
        http.delete(oauthUrl('anthropic'), () => {
          deleted = true;
          return HttpResponse.json({ ok: true, provider: { provider: 'anthropic', source: 'none' } });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useProvidersQuery(),
        remove: useRemoveProviderOAuth(),
      }));

      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('oauth'));

      await act(async () => {
        await result.current.remove.mutateAsync({ provider: 'anthropic' });
      });
      await waitForMutationsIdle(client);

      await waitFor(() => expect(result.current.query.data?.providers[0]?.source).toBe('none'));
    });
  });
});
