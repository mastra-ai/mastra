import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  useActivateAgentVersion,
  useAgentVersion,
  useAgentVersions,
  useCompareAgentVersions,
  useCreateAgentVersion,
  useDeleteAgentVersion,
  useRestoreAgentVersion,
} from '../use-agent-versions';
import {
  activatedVersion,
  deletedVersion,
  makeAgentVersion,
  makeAgentVersionsList,
  makeStoredAgent,
} from './fixtures/editor-agents';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const AGENT_ID = 'agent-1';
const VERSION_1 = 'version-1';
const VERSION_2 = 'version-2';


describe('when Studio users publish and compare stored agent versions', () => {
  it('loads, reads, and compares stored-agent versions with route ordering query params intact', async () => {
    const versionOne = makeAgentVersion({ id: VERSION_1, agentId: AGENT_ID, versionNumber: 1, instructions: 'Version one' });
    const versionTwo = makeAgentVersion({ id: VERSION_2, agentId: AGENT_ID, versionNumber: 2, instructions: 'Version two' });
    const onList = vi.fn<(url: URL) => void>();
    const onCompare = vi.fn<(url: URL) => void>();

    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, ({ request }) => {
        const url = new URL(request.url);
        onList(url);
        expect(url.searchParams.get('orderBy[field]')).toBe('versionNumber');
        expect(url.searchParams.get('orderBy[direction]')).toBe('DESC');
        return HttpResponse.json(makeAgentVersionsList([versionTwo, versionOne]));
      }),
      http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${VERSION_1}`, () => HttpResponse.json(versionOne)),
      http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/compare`, ({ request }) => {
        const url = new URL(request.url);
        onCompare(url);
        expect(url.searchParams.get('from')).toBe(VERSION_1);
        expect(url.searchParams.get('to')).toBe(VERSION_2);
        return HttpResponse.json({ fromVersion: versionOne, toVersion: versionTwo, diffs: [{ field: 'instructions', previousValue: 'Version one', currentValue: 'Version two' }] });
      }),
    );

    const { wrapper } = makeWrapper({ router: true });
    const listHook = renderHook(
      () => useAgentVersions({ agentId: AGENT_ID, params: { orderBy: { field: 'versionNumber', direction: 'DESC' } } }),
      { wrapper },
    );
    const detailHook = renderHook(() => useAgentVersion({ agentId: AGENT_ID, versionId: VERSION_1 }), { wrapper });
    const compareHook = renderHook(
      () => useCompareAgentVersions({ agentId: AGENT_ID, fromVersionId: VERSION_1, toVersionId: VERSION_2 }),
      { wrapper },
    );

    await waitFor(() => expect(listHook.result.current.data?.versions[0]?.id).toBe(VERSION_2));
    await waitFor(() => expect(detailHook.result.current.data?.instructions).toBe('Version one'));
    await waitFor(() => expect(compareHook.result.current.data?.diffs[0]?.field).toBe('instructions'));

    expect(onList).toHaveBeenCalledTimes(1);
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it('creates, activates, restores, and deletes versions while invalidating editor runtime caches', async () => {
    const restored = makeAgentVersion({ id: 'version-3', agentId: AGENT_ID, versionNumber: 3, instructions: 'Restored v1' });
    let createBody: Record<string, unknown> | null = null;
    const onActivate = vi.fn<() => void>();
    const onRestore = vi.fn<() => void>();
    const onDelete = vi.fn<() => void>();

    server.use(
      http.post(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, async ({ request }) => {
        createBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAgentVersion({ id: VERSION_2, agentId: AGENT_ID, versionNumber: 2 }));
      }),
      http.post(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${VERSION_2}/activate`, () => {
        onActivate();
        return HttpResponse.json(activatedVersion);
      }),
      http.post(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${VERSION_1}/restore`, () => {
        onRestore();
        return HttpResponse.json(restored);
      }),
      http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/${VERSION_1}`, () => {
        onDelete();
        return HttpResponse.json(deletedVersion);
      }),
    );

    const { queryClient, wrapper } = makeWrapper({ router: true });
    queryClient.setQueryData(['agent-versions', AGENT_ID], makeAgentVersionsList([makeAgentVersion({ id: VERSION_1 })]));
    queryClient.setQueryData(['agent', AGENT_ID], makeStoredAgent({ id: AGENT_ID, activeVersionId: VERSION_1 }));

    const createHook = renderHook(() => useCreateAgentVersion({ agentId: AGENT_ID }), { wrapper });
    const activateHook = renderHook(() => useActivateAgentVersion({ agentId: AGENT_ID }), { wrapper });
    const restoreHook = renderHook(() => useRestoreAgentVersion({ agentId: AGENT_ID }), { wrapper });
    const deleteHook = renderHook(() => useDeleteAgentVersion({ agentId: AGENT_ID }), { wrapper });

    await act(async () => {
      await createHook.result.current.mutateAsync({ changeMessage: 'Saved draft before publish' });
      await activateHook.result.current.mutateAsync(VERSION_2);
      await restoreHook.result.current.mutateAsync(VERSION_1);
      await deleteHook.result.current.mutateAsync(VERSION_1);
    });
    await waitForMutationsIdle(queryClient);

    expect(createBody).toEqual({ changeMessage: 'Saved draft before publish' });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(['agent-versions', AGENT_ID])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['agent', AGENT_ID])?.isInvalidated).toBe(true);
  });
});
