import { useQuery } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { AGENT_CONTROLLER_ID } from '../../ui/domains/chat/services/constants';
import { useActivateModelPack, useModelPacksQuery, useRemoveModelPack, useSaveModelPack } from '../use-model-packs';
import { packsResponse } from './fixtures/model-packs';

const URL = `${TEST_BASE_URL}/web/config/model-packs`;

describe('useModelPacksQuery', () => {
  describe('when packs are loaded', () => {
    it('returns the personal active pack without session-scoped query parameters', async () => {
      let seenUrl = '';
      server.use(
        http.get(URL, ({ request }) => {
          seenUrl = request.url;
          return HttpResponse.json(packsResponse('builtin:balanced'));
        }),
      );

      const { result } = renderHookWithProviders(() => useModelPacksQuery());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.packs).toHaveLength(2);
      expect(result.current.data?.activePackId).toBe('builtin:balanced');
      expect(new globalThis.URL(seenUrl).search).toBe('');
    });
  });
});

describe('useActivateModelPack', () => {
  describe('when a pack is activated', () => {
    it('sets the personal default without changing the current session', async () => {
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
        query: useModelPacksQuery(),
        activate: useActivateModelPack('res-1'),
      }));

      await waitFor(() => expect(result.current.query.data?.activePackId).toBe(null));

      await act(async () => {
        await result.current.activate.mutateAsync({ id: 'builtin:balanced', target: 'default' });
      });
      await waitForMutationsIdle(client);

      expect(activateBody).toEqual({ target: 'default' });
      await waitFor(() => expect(result.current.query.data?.activePackId).toBe('builtin:balanced'));
    });

    it('refreshes the active session model after applying a thread pack', async () => {
      let modelId = 'p/build';
      const readState = vi.fn(async () => ({ modelId }));
      server.use(
        http.post(`${URL}/${encodeURIComponent('mine')}/activate`, async () => {
          modelId = 'p/build-2';
          return HttpResponse.json({ ok: true, activePackId: 'mine' });
        }),
      );

      const { result, client } = renderHookWithProviders(() => ({
        state: useQuery({
          queryKey: queryKeys.agentControllerConnectionState(AGENT_CONTROLLER_ID, 'res-1', '/tmp/res-1'),
          queryFn: readState,
          staleTime: Infinity,
        }),
        activate: useActivateModelPack('res-1', '/tmp/res-1'),
      }));

      await waitFor(() => expect(result.current.state.data?.modelId).toBe('p/build'));
      await act(async () => {
        await result.current.activate.mutateAsync({ id: 'mine', target: 'session' });
      });
      await waitForMutationsIdle(client);

      expect(readState).toHaveBeenCalledTimes(2);
      expect(result.current.state.data?.modelId).toBe('p/build-2');
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
        query: useModelPacksQuery(),
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
        query: useModelPacksQuery(),
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
