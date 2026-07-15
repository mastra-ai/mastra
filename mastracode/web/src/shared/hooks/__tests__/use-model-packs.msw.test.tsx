import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useActivateModelPack, useModelPacksQuery, useRemoveModelPack, useSaveModelPack } from '../use-model-packs';
import { packsResponse } from './fixtures/model-packs';

const URL = `${TEST_BASE_URL}/web/config/model-packs`;

describe('useModelPacksQuery', () => {
  describe('when no resourceId is provided', () => {
    it('still loads packs but without a resourceId query param', async () => {
      let seenUrl = '';
      server.use(
        http.get(URL, ({ request }) => {
          seenUrl = request.url;
          return HttpResponse.json(packsResponse(null));
        }),
      );

      const { result } = renderHookWithProviders(() => useModelPacksQuery(undefined));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.packs).toHaveLength(2);
      expect(new global.URL(seenUrl).searchParams.has('resourceId')).toBe(false);
    });
  });

  describe('when a resourceId is provided', () => {
    it('passes resourceId and returns the active pack', async () => {
      let seenResource: string | null = null;
      server.use(
        http.get(URL, ({ request }) => {
          seenResource = new global.URL(request.url).searchParams.get('resourceId');
          return HttpResponse.json(packsResponse('builtin:balanced'));
        }),
      );

      const { result } = renderHookWithProviders(() => useModelPacksQuery('res-1'));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(seenResource).toBe('res-1');
      expect(result.current.data?.activePackId).toBe('builtin:balanced');
    });
  });
});

describe('useActivateModelPack', () => {
  describe('when a pack is activated', () => {
    it('POSTs resourceId and invalidates the resource-scoped list', async () => {
      let activeId: string | null = null;
      let activateBody: unknown;
      server.use(
        http.get(URL, () => HttpResponse.json(packsResponse(activeId))),
        http.post(`${URL}/${encodeURIComponent('builtin:balanced')}/activate`, async ({ request }) => {
          activateBody = await request.json();
          activeId = 'builtin:balanced';
          return HttpResponse.json({ ok: true, activePackId: 'builtin:balanced' });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useModelPacksQuery('res-1'),
        activate: useActivateModelPack('res-1'),
      }));

      await waitFor(() => expect(result.current.query.data?.activePackId).toBe(null));

      await act(async () => {
        await result.current.activate.mutateAsync({ id: 'builtin:balanced' });
      });
      await waitForMutationsIdle(client);

      expect(activateBody).toEqual({ resourceId: 'res-1' });
      await waitFor(() => expect(result.current.query.data?.activePackId).toBe('builtin:balanced'));
    });
  });
});

describe('useSaveModelPack', () => {
  describe('when a custom pack is created', () => {
    it('POSTs the pack body and invalidates the list', async () => {
      const onGet = vi.fn(() => HttpResponse.json(packsResponse(null)));
      let postBody: unknown;
      server.use(
        http.get(URL, onGet),
        http.post(URL, async ({ request }) => {
          postBody = await request.json();
          return HttpResponse.json({ ok: true, pack: { id: 'custom:New', name: 'New', models: {} } });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useModelPacksQuery('res-1'),
        save: useSaveModelPack(),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      const callsBefore = onGet.mock.calls.length;

      await act(async () => {
        await result.current.save.mutateAsync({
          name: 'New',
          models: { build: 'b', plan: 'p', fast: 'f' },
        });
      });
      await waitForMutationsIdle(client);

      expect(postBody).toEqual({ name: 'New', models: { build: 'b', plan: 'p', fast: 'f' } });
      await waitFor(() => expect(onGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });
  });
});

describe('useRemoveModelPack', () => {
  describe('when a custom pack is removed', () => {
    it('DELETEs by id and invalidates the list', async () => {
      const onGet = vi.fn(() => HttpResponse.json(packsResponse(null)));
      let removed = false;
      server.use(
        http.get(URL, onGet),
        http.delete(`${URL}/${encodeURIComponent('custom:Mine')}`, () => {
          removed = true;
          return HttpResponse.json({ ok: true });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        query: useModelPacksQuery('res-1'),
        remove: useRemoveModelPack(),
      }));

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      const callsBefore = onGet.mock.calls.length;

      await act(async () => {
        await result.current.remove.mutateAsync({ id: 'custom:Mine' });
      });
      await waitForMutationsIdle(client);

      expect(removed).toBe(true);
      await waitFor(() => expect(onGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });
  });
});
