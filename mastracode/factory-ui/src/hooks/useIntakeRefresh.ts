import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { IntakeRefreshResponse } from '../api/types';
import type { BoardRequestError } from './useBoardEditor';
import { sendRouteRequest } from './useIntakeRoutes';

/**
 * Reconciles the project's intake sources now: integrations re-read their sources, refresh the project's cards and
 * file what is missing. Events can be dropped, so this is the board's way to catch up without waiting for the
 * hourly sweep. Settles once every integration has finished, then re-reads the board's cards.
 */
export function useIntakeRefresh(factoryProjectId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<IntakeRefreshResponse, BoardRequestError>({
    mutationFn: () =>
      sendRouteRequest<IntakeRefreshResponse>(
        baseUrl,
        `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/intake/refresh`,
        { method: 'POST' },
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) }),
  });
}
