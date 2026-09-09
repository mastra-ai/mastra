import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../e2e/ui/render';
import type { BoardCatalogResponse } from '../api/types';
import { useBoardCatalog } from './useBoardCatalog';

const catalog: BoardCatalogResponse = {
  boards: [
    {
      id: 'release',
      title: 'Release Preview',
      initialPhase: 'queued',
      phases: [
        { id: 'queued', title: 'Queued', kind: 'resting', transitions: [{ outcome: null, to: 'shipping' }] },
        { id: 'shipping', title: 'Shipping', kind: 'working', role: 'publisher', transitions: [] },
      ],
    },
  ],
};
const endpoint = `${TEST_BASE_URL}/web/factory/projects/:id/boards`;

describe('installed board catalog query', () => {
  it('exposes loading without substituting built-in boards, then preserves metadata', async () => {
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.get(endpoint, async () => {
        await gate;
        return HttpResponse.json(catalog);
      }),
    );
    const { result } = renderHookWithProviders(() => useBoardCatalog('project-1'));
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(catalog.boards);
  });

  it('exposes failures rather than returning fallback boards', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ error: 'unavailable' }, { status: 503 })));
    const { result } = renderHookWithProviders(() => useBoardCatalog('project-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('distinguishes empty installations and scopes the cache to the project', async () => {
    server.use(
      http.get(endpoint, ({ params }) =>
        HttpResponse.json(params.id === 'project-1' ? catalog : ({ boards: [] } satisfies BoardCatalogResponse)),
      ),
    );
    const { result, rerender } = renderHookWithProviders(({ id }) => useBoardCatalog(id), {
      initialProps: { id: 'project-1' },
    });
    await waitFor(() => expect(result.current.data).toEqual(catalog.boards));
    rerender({ id: 'project-2' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(result.current.isSuccess).toBe(true);
  });
});
