import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import type { CustomProviderCheckFailure, CustomProviderCheckResponse, CustomProviderInfo } from '../../api/types';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import {
  useCheckCustomProvider,
  useCustomProvidersQuery,
  useRemoveCustomProvider,
  useSaveCustomProvider,
} from '../use-custom-providers';
import { customProvider, customProvidersResponse } from './fixtures/custom-providers';

const URL = `${TEST_BASE_URL}/web/config/custom-providers`;

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

describe('useCheckCustomProvider', () => {
  it('checks a saved endpoint by id and refetches the list so its row shows the recorded result', async () => {
    const failure: CustomProviderCheckFailure = {
      kind: 'http',
      status: 401,
      message: 'HTTP 401 Unauthorized from https://api.my-llm.test/v1/models',
    };
    const checkResponse: CustomProviderCheckResponse = {
      ok: true,
      check: { models: { ok: false, failure, latencyMs: 40 } },
    };
    const recorded: CustomProviderInfo = {
      ...customProvider,
      lastCheck: { at: '2026-11-26T10:00:00.000Z', ok: false, message: failure.message },
    };
    let checked = false;
    let checkBody: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json({ providers: [checked ? recorded : customProvider] })),
      http.post(`${URL}/check`, async ({ request }) => {
        checkBody = await request.json();
        checked = true;
        return HttpResponse.json(checkResponse);
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      query: useCustomProvidersQuery(),
      check: useCheckCustomProvider(),
    }));
    await waitFor(() => expect(result.current.query.data).toEqual([customProvider]));

    let response: Awaited<ReturnType<typeof result.current.check.mutateAsync>> | undefined;
    await act(async () => {
      response = await result.current.check.mutateAsync({ previousId: 'my-llm', scope: 'user' });
    });
    await waitForMutationsIdle(client);

    expect(checkBody).toEqual({ previousId: 'my-llm', scope: 'user' });
    expect(response).toEqual(checkResponse);
    await waitFor(() => expect(result.current.query.data).toEqual([recorded]));
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
        await result.current.remove.mutateAsync({ id: 'my-llm', scope: 'user' });
      });
      await waitForMutationsIdle(client);

      await waitFor(() => expect(result.current.query.data).toEqual([]));
    });
  });
});
