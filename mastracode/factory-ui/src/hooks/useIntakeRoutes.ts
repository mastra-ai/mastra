import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { IntakeRouteInfo, IntakeRouteInput, IntakeRouteListResponse, IntakeRoutePatch } from '../api/types';
import { BoardRequestError } from './useBoardEditor';

function routesPath(factoryProjectId: string, suffix = '') {
  return `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/intake-routes${suffix}`;
}

async function sendRouteRequest<T>(
  baseUrl: string,
  path: string,
  init?: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => undefined);
  const refusal = body as { error?: string; message?: string } | undefined;
  if (!res.ok || !refusal || refusal.error !== undefined) {
    throw new BoardRequestError(
      res.status,
      refusal?.error,
      refusal?.message ?? refusal?.error ?? `Request failed (${res.status})`,
    );
  }
  return body as T;
}

/** The project's intake routes in the order they are tried, and whether the caller may change them. */
export function useIntakeRoutesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeRoutes(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => sendRouteRequest<IntakeRouteListResponse>(baseUrl, routesPath(factoryProjectId!)),
  });
}

type RouteWrite =
  | { kind: 'create'; route: IntakeRouteInput }
  | { kind: 'update'; id: string; patch: IntakeRoutePatch }
  | { kind: 'delete'; id: string; expectedRevision: number }
  | { kind: 'reorder'; ids: string[] };

/**
 * Changes the project's intake routes, one request after another, then reloads them. A change
 * someone else made first refuses with `revision_mismatch` (or, for a reorder, `intake_route_set_mismatch`).
 */
export function useIntakeRouteWrites(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<void, BoardRequestError, RouteWrite[]>({
    mutationFn: async writes => {
      const project = factoryProjectId!;
      for (const write of writes) {
        if (write.kind === 'create') {
          await sendRouteRequest(baseUrl, routesPath(project), { method: 'POST', body: write.route });
        } else if (write.kind === 'update') {
          await sendRouteRequest(baseUrl, routesPath(project, `/${encodeURIComponent(write.id)}`), {
            method: 'PATCH',
            body: write.patch,
          });
        } else if (write.kind === 'delete') {
          const query = new URLSearchParams({ expectedRevision: String(write.expectedRevision) });
          await sendRouteRequest(baseUrl, routesPath(project, `/${encodeURIComponent(write.id)}?${query}`), {
            method: 'DELETE',
          });
        } else {
          await sendRouteRequest(baseUrl, routesPath(project, '/reorder'), {
            method: 'POST',
            body: { ids: write.ids },
          });
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.intakeRoutes(factoryProjectId) }),
  });
}
