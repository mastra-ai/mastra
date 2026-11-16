import { skipToken, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  IntakeNotRoutedResponse,
  IntakeOrderResponse,
  IntakeRouteAgainResponse,
  IntakeSkippedResponse,
} from '../api/types';
import type { BoardRequestError } from './useBoardEditor';
import { sendRouteRequest } from './useIntakeRoutes';

const NOT_ROUTED_PAGE = 20;

function projectPath(factoryProjectId: string, suffix: string) {
  return `/web/factory/projects/${encodeURIComponent(factoryProjectId)}${suffix}`;
}

/** The order intake asks the project's boards to take a new item, and how it compares with the old route list. */
export function useIntakeOrderQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeOrder(factoryProjectId),
    queryFn: factoryProjectId
      ? () => sendRouteRequest<IntakeOrderResponse>(baseUrl, projectPath(factoryProjectId, '/intake-order'))
      : skipToken,
  });
}

/** Sets the intake order: every board of the project, once each. */
export function useSaveIntakeOrder(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<IntakeOrderResponse, BoardRequestError, string[]>({
    mutationFn: boardKeys =>
      sendRouteRequest<IntakeOrderResponse>(baseUrl, projectPath(factoryProjectId!, '/intake-order'), {
        method: 'PUT',
        body: { boardKeys },
      }),
    onSuccess: order => queryClient.setQueryData(queryKeys.intakeOrder(factoryProjectId), order),
  });
}

/** Items no board's intake rules took, oldest first, a page at a time. */
export function useNotRoutedQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.intakeNotRouted(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ pageParam }) => {
          const query = new URLSearchParams({ limit: String(NOT_ROUTED_PAGE) });
          if (pageParam) query.set('cursor', pageParam);
          return sendRouteRequest<IntakeNotRoutedResponse>(
            baseUrl,
            projectPath(factoryProjectId, `/intake/not-routed?${query}`),
          );
        }
      : skipToken,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
}

/** Runs intake again for a Not routed item; it is filed once the dispatcher picks it up. */
export function useRouteAgain(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation<IntakeRouteAgainResponse, BoardRequestError, string>({
    mutationFn: decisionId =>
      sendRouteRequest<IntakeRouteAgainResponse>(
        baseUrl,
        projectPath(factoryProjectId!, `/intake/not-routed/${encodeURIComponent(decisionId)}/route-again`),
        { method: 'POST' },
      ),
    // The item stays Not routed on the server until the dispatcher files it, so a refetch now would bring it back:
    // take it off the list instead. A failure refetches, keeping whatever is still Not routed.
    onSuccess: (_, decisionId) =>
      queryClient.setQueryData<InfiniteData<IntakeNotRoutedResponse>>(
        queryKeys.intakeNotRouted(factoryProjectId),
        data =>
          data && {
            ...data,
            pages: data.pages.map(page => ({
              ...page,
              notRouted: page.notRouted.filter(item => item.id !== decisionId),
            })),
          },
      ),
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.intakeNotRouted(factoryProjectId) }),
  });
}

/** How often each card-move rule was skipped in the last 30 days, because its target couldn't take the card. */
export function useSkippedRulesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeSkipped(factoryProjectId),
    queryFn: factoryProjectId
      ? () => sendRouteRequest<IntakeSkippedResponse>(baseUrl, projectPath(factoryProjectId, '/intake/skipped'))
      : skipToken,
  });
}
