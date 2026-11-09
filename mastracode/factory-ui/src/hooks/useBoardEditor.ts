import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ReplaceBoardBody, StoredBoardResponse } from '../api/types';

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
  const body = (await res.json().catch(() => undefined)) as
    | (StoredBoardResponse & { error?: undefined; message?: undefined; conflicts?: undefined })
    | { board?: undefined; error?: string; message?: string; conflicts?: string[] }
    | undefined;
  if (!res.ok || !body?.board) {
    throw new BoardRequestError(
      res.status,
      body?.error,
      body?.message ?? body?.error ?? `Request failed (${res.status})`,
      body?.conflicts,
    );
  }
  return body;
}

function boardPath(factoryProjectId: string, boardKey: string) {
  return `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/boards/${encodeURIComponent(boardKey)}`;
}

/** One board of a project as stored, with its revision and whether the caller may edit it. Mirrors `GET …/boards/:boardKey`. */
export function useBoardQuery(factoryProjectId: string | undefined, boardKey: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.board(factoryProjectId, boardKey),
    enabled: !!factoryProjectId,
    queryFn: () => sendBoardRequest(baseUrl, boardPath(factoryProjectId!, boardKey)),
  });
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
