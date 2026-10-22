import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { useOMQuery, useUpdateOMModel, useUpdateOMObserveAttachments, useUpdateOMThresholds } from '../use-om';
import { omResponse } from './fixtures/om';

const URL = `${TEST_BASE_URL}/web/config/om`;

describe('chat thread context', () => {
  it('sends the thread on the settings read and every settings write', async () => {
    const seenGet = vi.fn();
    const seenPuts = vi.fn();
    server.use(
      http.get(URL, ({ request }) => {
        const url = new global.URL(request.url);
        seenGet({
          sessionId: url.searchParams.get('sessionId'),
          threadId: url.searchParams.get('threadId'),
          resourceId: url.searchParams.get('resourceId'),
        });
        return HttpResponse.json(omResponse());
      }),
      http.put(`${URL}/:setting`, async ({ params, request }) => {
        seenPuts(params.setting, await request.json());
        return HttpResponse.json({ ok: true, config: omResponse().config });
      }),
      http.put(`${URL}/:role/model`, async ({ params, request }) => {
        seenPuts(`${params.role}/model`, await request.json());
        return HttpResponse.json({ ok: true, config: omResponse().config });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      query: useOMQuery('session-1', undefined, 'thread-1', 'resource-1'),
      model: useUpdateOMModel('session-1', 'observer', undefined, 'thread-1', 'resource-1'),
      thresholds: useUpdateOMThresholds('session-1', undefined, 'thread-1', 'resource-1'),
      attachments: useUpdateOMObserveAttachments('session-1', undefined, 'thread-1', 'resource-1'),
    }));

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    await act(async () => {
      await result.current.model.mutateAsync({ modelId: 'auto' });
      await result.current.thresholds.mutateAsync({ observationThreshold: 3_000 });
      await result.current.attachments.mutateAsync({ value: true });
    });
    await waitForMutationsIdle(client);

    expect(seenGet).toHaveBeenCalledWith({
      sessionId: 'session-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
    });
    expect(seenPuts).toHaveBeenCalledWith('observer/model', {
      sessionId: 'session-1',
      modelId: 'auto',
      threadId: 'thread-1',
      resourceId: 'resource-1',
    });
    expect(seenPuts).toHaveBeenCalledWith('thresholds', {
      sessionId: 'session-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      observationThreshold: 3_000,
    });
    expect(seenPuts).toHaveBeenCalledWith('observe-attachments', {
      sessionId: 'session-1',
      value: true,
      threadId: 'thread-1',
      resourceId: 'resource-1',
    });
  });
});

describe('useOMQuery', () => {
  describe('when no sessionId is provided', () => {
    it('loads persisted settings without a session', async () => {
      const onGet = vi.fn(() => HttpResponse.json(omResponse()));
      server.use(http.get(URL, onGet));

      const { result } = renderHookWithProviders(() => useOMQuery(undefined));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(onGet).toHaveBeenCalledOnce();
      expect(result.current.data).toEqual(omResponse());
    });
  });

  describe('when two sessions are open', () => {
    it('keeps their server responses isolated in the query cache', async () => {
      server.use(
        http.get(URL, ({ request }) => {
          const sessionId = new global.URL(request.url).searchParams.get('sessionId');
          return HttpResponse.json(omResponse({ observationThreshold: sessionId === 'session-b' ? 22_000 : 11_000 }));
        }),
      );

      const { result } = renderHookWithProviders(() => ({
        user: useOMQuery('session-a', 'factory-1'),
        org: useOMQuery('session-b', 'factory-1'),
      }));

      await waitFor(() => expect(result.current.user.isSuccess && result.current.org.isSuccess).toBe(true));
      expect(result.current.user.data?.config.observationThreshold).toBe(11_000);
      expect(result.current.org.data?.config.observationThreshold).toBe(22_000);
    });
  });

  describe('when a sessionId is provided', () => {
    it('passes sessionId and returns the config', async () => {
      let seenResource: string | null = null;
      server.use(
        http.get(URL, ({ request }) => {
          seenResource = new global.URL(request.url).searchParams.get('sessionId');
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

      expect(putBody).toEqual({ sessionId: 'res-1', observationThreshold: 55_000 });
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
          HttpResponse.json({
            ok: true,
            config: omResponse({
              observer: {
                model: 'p/new-observer',
                effectiveModelId: 'p/new-observer',
                effectiveModelSource: 'explicit',
                providerStatus: 'available',
              },
              observerModelId: 'p/new-observer',
            }).config,
          }),
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

      expect(result.current.query.data?.config.observer.effectiveModelId).toBe('p/new-observer');
    });
  });

  describe('when a role is reset to auto', () => {
    it('PUTs auto intent and caches the effective concrete model returned by the server', async () => {
      let putBody: unknown;
      server.use(
        http.get(URL, () => HttpResponse.json(omResponse())),
        http.put(`${URL}/reflector/model`, async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({
            ok: true,
            config: omResponse({
              reflector: {
                model: 'auto',
                effectiveModelId: 'openai/gpt-5.4-mini',
                effectiveModelSource: 'live-session',
                providerStatus: 'available',
              },
              reflectorModelId: 'openai/gpt-5.4-mini',
            }).config,
          });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useOMQuery('res-1'),
        update: useUpdateOMModel('res-1', 'reflector'),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      await act(async () => {
        await result.current.update.mutateAsync({ modelId: 'auto' });
      });
      await waitForMutationsIdle(client);

      expect(putBody).toEqual({ sessionId: 'res-1', modelId: 'auto' });
      expect(result.current.query.data?.config.reflector).toEqual({
        model: 'auto',
        effectiveModelId: 'openai/gpt-5.4-mini',
        effectiveModelSource: 'live-session',
        providerStatus: 'available',
      });
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

      expect(putBody).toEqual({ sessionId: 'res-1', value: true });
      expect(result.current.query.data?.config.observeAttachments).toBe(true);
    });
  });
});
