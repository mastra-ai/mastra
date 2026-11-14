import { useMutation, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { IntakeDryRunBody, IntakeDryRunResponse, IntakeTestBody, IntakeTestResponse } from '../api/types';
import type { BoardRequestError } from './useBoardEditor';
import { sendRouteRequest } from './useIntakeRoutes';

function intakePath(factoryProjectId: string, suffix: string) {
  return `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/intake/${suffix}`;
}

/**
 * The saved intake rules run over the project's newest 200 items: what each board and rule would take,
 * what it loses to an earlier board, and what it filed in the last 30 days. Nothing is filed. Kept
 * under the routes' key, so a rule or order change refreshes it.
 */
export function useIntakeDryRunQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeDryRun(factoryProjectId),
    queryFn: () =>
      sendRouteRequest<IntakeDryRunResponse>(baseUrl, intakePath(factoryProjectId!, 'dry-run'), {
        method: 'POST',
        body: {},
      }),
    enabled: !!factoryProjectId,
  });
}

/** Runs unsaved rules or an unsaved intake order over the same items, against the saved ones. Admins only. */
export function useIntakeDryRunPreview(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useMutation<IntakeDryRunResponse, BoardRequestError, IntakeDryRunBody>({
    mutationFn: body =>
      sendRouteRequest<IntakeDryRunResponse>(baseUrl, intakePath(factoryProjectId!, 'dry-run'), {
        method: 'POST',
        body,
      }),
  });
}

/** "Where would this go?": one item by URL or id, with what every rule answered. Nothing is filed. */
export function useIntakeTest(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useMutation<IntakeTestResponse, BoardRequestError, IntakeTestBody>({
    mutationFn: body =>
      sendRouteRequest<IntakeTestResponse>(baseUrl, intakePath(factoryProjectId!, 'test'), { method: 'POST', body }),
  });
}
