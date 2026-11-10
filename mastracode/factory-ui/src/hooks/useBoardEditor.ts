import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { CreateBoardBody, ReplaceBoardBody, StoredBoardResponse } from '../api/types';

/** A refused board request, keeping the server's error code and, for code-behaviour refusals, every conflict. */
export class BoardRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    readonly conflicts: string[] = [],
  ) {
    super(message);
    this.name = 'BoardRequestError';
  }
}

type BoardRefusal = { board?: unknown; error?: string; message?: string; conflicts?: string[] };

function refusal(status: number, body: BoardRefusal | undefined): BoardRequestError {
  return new BoardRequestError(
    status,
    body?.error,
    body?.message ?? body?.error ?? `Request failed (${status})`,
    body?.conflicts,
  );
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

/** One board of a project as stored, with its revision and whether the caller may edit it. Mirrors `GET …/boards/:boardKey`. */
export function useBoardQuery(factoryProjectId: string | undefined, boardKey: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    ...storedBoardQueryOptions(baseUrl, factoryProjectId ?? '', boardKey),
    enabled: !!factoryProjectId,
  });
}

/** The read behind `useBoardQuery`, also used to load a board ahead of the page and to copy one into a new board. */
export function storedBoardQueryOptions(
  baseUrl: string,
  factoryProjectId: string,
  boardKey: string = DEFAULT_BOARD_ID,
) {
  return queryOptions({
    queryKey: queryKeys.board(factoryProjectId, boardKey),
    queryFn: () => sendBoardRequest(baseUrl, boardPath(factoryProjectId, boardKey)),
  });
}

/**
 * Whether the caller may create, edit and delete this project's boards (an organization admin).
 * Read off the Work board, which every project stores; the server enforces it on every write.
 */
export function useCanEditBoards(factoryProjectId: string | undefined): boolean {
  return useBoardQuery(factoryProjectId, DEFAULT_BOARD_ID).data?.canEdit ?? false;
}

function useBoardWrite<Input>(
  factoryProjectId: string | undefined,
  boardKey: string,
  request: (input: Input) => { method: 'PATCH' | 'POST'; suffix: string; body: unknown },
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, BoardRequestError, Input>({
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

/** Save an edited board; refused with `revision_mismatch` when someone changed it since `expectedRevision`. */
export function useSaveBoardMutation(factoryProjectId: string | undefined, boardKey: string) {
  return useBoardWrite<ReplaceBoardBody>(factoryProjectId, boardKey, body => ({ method: 'PATCH', suffix: '', body }));
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
 * Create a board of the project's own. Refused with `code_board` for a key
 * Factory keeps, and `board_exists` for one the project already uses.
 */
export function useCreateBoardMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, BoardRequestError, CreateBoardBody>({
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
  return useMutation<void, BoardRequestError, number>({
    mutationFn: async expectedRevision => {
      const res = await fetch(
        `${baseUrl}${boardPath(factoryProjectId!, boardKey)}?expectedRevision=${expectedRevision}`,
        { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw refusal(res.status, (await res.json().catch(() => undefined)) as BoardRefusal | undefined);
    },
    onSuccess: async () => {
      onDeleted();
      queryClient.removeQueries({ queryKey: queryKeys.board(factoryProjectId, boardKey), exact: true });
      await queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}
