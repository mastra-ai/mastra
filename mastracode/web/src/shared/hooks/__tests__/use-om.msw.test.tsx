import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { queryKeys } from '../../api/keys';
import { useOMQuery, useUpdateOMModel, useUpdateOMObserveAttachments, useUpdateOMThresholds } from '../use-om';
import { omResponse } from './fixtures/om';

const URL = `${TEST_BASE_URL}/web/config/om`;

describe('useOMQuery', () => {
  describe('when no resourceId is provided', () => {
    it('loads persisted settings without a session', async () => {
      const onGet = vi.fn(() => HttpResponse.json(omResponse()));
      server.use(http.get(URL, onGet));

      const { result } = renderHookWithProviders(() => useOMQuery(undefined));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(onGet).toHaveBeenCalledOnce();
      expect(result.current.data).toEqual(omResponse());
    });
  });

  describe('when a resourceId is provided', () => {
    it('passes resourceId and returns the config', async () => {
      let seenResource: string | null = null;
      server.use(
        http.get(URL, ({ request }) => {
          seenResource = new global.URL(request.url).searchParams.get('resourceId');
          return HttpResponse.json(omResponse({ observationThreshold: 12_000 }));
        }),
      );

      const { result } = renderHookWithProviders(() => useOMQuery('res-1'));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(seenResource).toBe('res-1');
      expect(result.current.data?.config.observationThreshold).toBe(12_000);
    });
  });

  describe('when the GET fails', () => {
    it('surfaces the error', async () => {
      server.use(http.get(URL, () => HttpResponse.json({ error: 'No session' }, { status: 404 })));

      const { result } = renderHookWithProviders(() => useOMQuery('res-1'));

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});

describe('useUpdateOMThresholds', () => {
  describe('when a threshold is updated', () => {
    it('PUTs the body and writes the returned config into the cache without refetching', async () => {
      const onGet = vi.fn(() => HttpResponse.json(omResponse({ observationThreshold: 30_000 })));
      let putBody: unknown;
      server.use(
        http.get(URL, onGet),
        http.put(`${URL}/thresholds`, async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true, config: omResponse({ observationThreshold: 55_000 }).config });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useOMQuery('res-1'),
        update: useUpdateOMThresholds('res-1'),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      const callsBefore = onGet.mock.calls.length;

      await act(async () => {
        await result.current.update.mutateAsync({ observationThreshold: 55_000 });
      });
      await waitForMutationsIdle(client);

      expect(putBody).toEqual({ resourceId: 'res-1', observationThreshold: 55_000 });
      const cached = client.getQueryData(queryKeys.om('res-1'));
      expect(cached).toEqual(omResponse({ observationThreshold: 55_000 }));
      // single-response UX: no refetch
      expect(onGet.mock.calls.length).toBe(callsBefore);
    });
  });
});

describe('useUpdateOMModel', () => {
  describe('when a role model is updated', () => {
    it('PUTs to the role route and updates the cache from the response', async () => {
      server.use(
        http.get(URL, () => HttpResponse.json(omResponse())),
        http.put(`${URL}/observer/model`, () =>
          HttpResponse.json({ ok: true, config: omResponse({ observerModelId: 'p/new-observer' }).config }),
        ),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useOMQuery('res-1'),
        update: useUpdateOMModel('res-1', 'observer'),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      await act(async () => {
        await result.current.update.mutateAsync({ modelId: 'p/new-observer' });
      });
      await waitForMutationsIdle(client);

      expect(result.current.query.data?.config.observerModelId).toBe('p/new-observer');
    });
  });
});

describe('useUpdateOMObserveAttachments', () => {
  describe('when the observe-attachments setting changes', () => {
    it('PUTs the value and updates the cache from the response', async () => {
      let putBody: unknown;
      server.use(
        http.get(URL, () => HttpResponse.json(omResponse({ observeAttachments: 'auto' }))),
        http.put(`${URL}/observe-attachments`, async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true, config: omResponse({ observeAttachments: true }).config });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useOMQuery('res-1'),
        update: useUpdateOMObserveAttachments('res-1'),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      await act(async () => {
        await result.current.update.mutateAsync({ value: true });
      });
      await waitForMutationsIdle(client);

      expect(putBody).toEqual({ resourceId: 'res-1', value: true });
      expect(result.current.query.data?.config.observeAttachments).toBe(true);
    });
  });
});
