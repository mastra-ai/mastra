import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useToggleStoredAgentFavorite } from '../use-stored-agent-favorite';
import {
  favoritedAgent,
  makeStoredAgent,
  makeStoredAgentsList,
} from '../../../agents/hooks/__tests__/fixtures/editor-agents';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const AGENT_ID = 'favorite-agent';

describe('when Studio users favorite stored agents', () => {
  it('optimistically favorites stored-agent detail and list caches through the real favorite endpoint', async () => {
    const initialAgent = makeStoredAgent({ id: AGENT_ID, isFavorited: false, favoriteCount: 1 });
    server.use(
      http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/favorite`, () => HttpResponse.json(favoritedAgent)),
    );

    const { queryClient, wrapper } = makeWrapper({ router: true });
    queryClient.setQueryData(['stored-agent', AGENT_ID], initialAgent);
    queryClient.setQueryData(['stored-agents', { favoritedOnly: false }], makeStoredAgentsList([initialAgent]));

    const { result } = renderHook(() => useToggleStoredAgentFavorite(AGENT_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ favorited: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitForMutationsIdle(queryClient);

    const detail = queryClient.getQueryData<ReturnType<typeof makeStoredAgent>>(['stored-agent', AGENT_ID]);
    const list = queryClient.getQueryData<ReturnType<typeof makeStoredAgentsList>>([
      'stored-agents',
      { favoritedOnly: false },
    ]);
    expect(detail?.isFavorited).toBe(true);
    expect(detail?.favoriteCount).toBe(2);
    expect(list?.agents[0]?.isFavorited).toBe(true);
    expect(list?.agents[0]?.favoriteCount).toBe(2);
  });

  it('rolls optimistic favorite changes back when the server rejects the mutation', async () => {
    const initialAgent = makeStoredAgent({ id: AGENT_ID, isFavorited: false, favoriteCount: 1 });
    server.use(
      http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/favorite`, () =>
        HttpResponse.json({ message: 'favorites disabled' }, { status: 404 }),
      ),
    );

    const { queryClient, wrapper } = makeWrapper({ router: true });
    queryClient.setQueryData(['stored-agent', AGENT_ID], initialAgent);
    queryClient.setQueryData(['stored-agents', { favoritedOnly: false }], makeStoredAgentsList([initialAgent]));

    const { result } = renderHook(() => useToggleStoredAgentFavorite(AGENT_ID), { wrapper });

    await expect(result.current.mutateAsync({ favorited: true })).rejects.toThrow();
    await waitForMutationsIdle(queryClient);

    const detail = queryClient.getQueryData<ReturnType<typeof makeStoredAgent>>(['stored-agent', AGENT_ID]);
    const list = queryClient.getQueryData<ReturnType<typeof makeStoredAgentsList>>([
      'stored-agents',
      { favoritedOnly: false },
    ]);
    expect(detail?.isFavorited).toBe(false);
    expect(detail?.favoriteCount).toBe(1);
    expect(list?.agents[0]?.isFavorited).toBe(false);
    expect(list?.agents[0]?.favoriteCount).toBe(1);
  });
});
