import { FactoryRequestError } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BoardCatalogResponse, CreateBoardBody, StoredBoardResponse } from '../api/types';

type BoardRefusal = { board?: unknown; error?: string; message?: string; conflicts?: string[] };

function refusal(status: number, body: BoardRefusal | undefined): FactoryRequestError {
  return new FactoryRequestError(status, '', body?.message ?? body?.error ?? `Request failed (${status})`, body);
}

async function sendBoardRequest(
  baseUrl: string,
  path: string,
  init?: { method: 'PATCH' | 'POST'; body: unknown },
): Promise<StoredBoardResponse> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    ...(init ? { body: JSON.stringify(init.body) } : {}),
  }).catch(() => {
    throw new FactoryRequestError(0, '', 'Factory could not be reached.');
  });
  const body = (await res.json().catch(() => undefined)) as (Partial<StoredBoardResponse> & BoardRefusal) | undefined;
  if (!res.ok || !body?.board) throw refusal(res.status, body);
  return { ...body, board: body.board };
}

function boardsPath(factoryProjectId: string) {
  return `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/boards`;
}

function boardPath(factoryProjectId: string, boardKey: string) {
  return `${boardsPath(factoryProjectId)}/${encodeURIComponent(boardKey)}`;
}

/** A board write under the shared write key, so `useBoardWritePending` sees it. */
function useBoardWrite<Input>(
  factoryProjectId: string | undefined,
  boardKey: string,
  request: (input: Input) => { method: 'PATCH' | 'POST'; suffix: string; body: unknown },
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, FactoryRequestError, Input>({
    mutationKey: queryKeys.boardWrite(factoryProjectId, boardKey),
    mutationFn: input => {
      const { method, suffix, body } = request(input);
      return sendBoardRequest(baseUrl, `${boardPath(factoryProjectId!, boardKey)}${suffix}`, { method, body });
    },
    onSuccess: async response => {
      queryClient.setQueryData(queryKeys.board(factoryProjectId, boardKey), response);
      // The catalog serves the edited board to the rest of the app.
      await queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}

/** Reset a built-in or app board to its code definition. */
export function useResetBoardMutation(factoryProjectId: string | undefined, boardKey: string) {
  return useBoardWrite<number>(factoryProjectId, boardKey, expectedRevision => ({
    method: 'POST',
    suffix: '/reset',
    body: { expectedRevision },
  }));
}

/**
 * Create a board of the project's own. Refused with a 409 when the key is taken: `code_board` for a key
 * Factory keeps, and `board_exists` for one the project already uses.
 */
export function useCreateBoardMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, FactoryRequestError, CreateBoardBody>({
    mutationFn: body => sendBoardRequest(baseUrl, boardsPath(factoryProjectId!), { method: 'POST', body }),
    onSuccess: async response => {
      queryClient.setQueryData(queryKeys.board(factoryProjectId, response.board.key), response);
      // The sidebar and the board page read the new board from the catalog.
      await queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}

/**
 * Delete a board no card sits on; refused with `revision_mismatch` when someone changed it since
 * `expectedRevision`. `onDeleted` runs before the board leaves the cache, so the caller can leave
 * the board while whatever shows it is still mounted.
 */
export function useDeleteBoardMutation(factoryProjectId: string | undefined, boardKey: string, onDeleted: () => void) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<void, FactoryRequestError, number>({
    mutationKey: queryKeys.boardWrite(factoryProjectId, boardKey),
    mutationFn: async expectedRevision => {
      const res = await fetch(
        `${baseUrl}${boardPath(factoryProjectId!, boardKey)}?expectedRevision=${expectedRevision}`,
        { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw refusal(res.status, (await res.json().catch(() => undefined)) as BoardRefusal | undefined);
    },
    onSuccess: async () => {
      // The list still names the board until it is read again, and what shows next is picked from it.
      queryClient.setQueryData<BoardCatalogResponse>(
        queryKeys.boardCatalog(factoryProjectId),
        catalog => catalog && { ...catalog, boards: catalog.boards.filter(board => board.id !== boardKey) },
      );
      onDeleted();
      queryClient.removeQueries({ queryKey: queryKeys.board(factoryProjectId, boardKey), exact: true });
      await queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}
