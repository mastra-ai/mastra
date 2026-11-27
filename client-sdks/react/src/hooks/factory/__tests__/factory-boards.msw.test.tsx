// @vitest-environment jsdom
import { FactoryRequestError } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { factoryKeys } from '../keys';
import { useBoardCatalog, useBoardQuery, useCanEditBoards, useSaveBoardMutation } from '../use-boards';

const FP = 'fp-1';
const API = `${TEST_BASE_URL}/web/factory/projects/${FP}`;

const catalog = (title: string) => ({
  boards: [{ id: 'work', title, source: 'code', editable: true, problems: [], initialPhase: 'backlog', phases: [] }],
  problems: [],
});

const stored = (revision: number) => ({ board: { key: 'work', name: 'Work', phases: [] }, revision, canEdit: true });

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { queryClient, wrapper };
}

describe('Factory board definition hooks', () => {
  describe('when a board is saved', () => {
    it('keeps the saved board and reads the catalog again', async () => {
      let title = 'Work';
      server.use(
        http.get(`${API}/boards`, () => HttpResponse.json(catalog(title))),
        http.get(`${API}/boards/work`, () => HttpResponse.json(stored(1))),
        http.patch(`${API}/boards/work`, () => {
          title = 'Renamed';
          return HttpResponse.json(stored(2));
        }),
      );
      const { queryClient, wrapper } = setup();
      const { result } = renderHook(
        () => ({
          boards: useBoardCatalog(FP),
          board: useBoardQuery(FP, 'work'),
          save: useSaveBoardMutation(FP, 'work'),
        }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.boards.data?.[0]?.title).toBe('Work'));
      await act(() => result.current.save.mutateAsync({ name: 'Renamed', phases: [], expectedRevision: 1 }));
      expect(queryClient.getQueryData(factoryKeys.board(FP, 'work'))).toMatchObject({ revision: 2 });
      await waitFor(() => expect(result.current.boards.data?.[0]?.title).toBe('Renamed'));
    });
  });

  describe('when someone saved the board first', () => {
    it('refuses with revision_mismatch', async () => {
      server.use(
        http.patch(`${API}/boards/work`, () =>
          HttpResponse.json({ error: 'revision_mismatch', message: 'Board changed' }, { status: 409 }),
        ),
      );
      const { result } = renderHook(() => useSaveBoardMutation(FP, 'work'), { wrapper: setup().wrapper });
      const refused = await result.current
        .mutateAsync({ name: 'Work', phases: [], expectedRevision: 1 })
        .catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(FactoryRequestError);
      expect(refused).toMatchObject({ status: 409, code: 'revision_mismatch' });
    });
  });

  describe('when the intake routes answer', () => {
    it('reads whether the caller may edit boards off them', async () => {
      server.use(http.get(`${API}/intake-routes`, () => HttpResponse.json({ intakeRoutes: [], canEdit: true })));
      const { result } = renderHook(() => useCanEditBoards(FP), { wrapper: setup().wrapper });
      await waitFor(() => expect(result.current).toBe(true));
    });
  });
});
