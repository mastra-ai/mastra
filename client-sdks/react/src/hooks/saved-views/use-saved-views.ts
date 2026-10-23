import type { CreateSavedViewParams, SavedViewResponse, UpdateSavedViewParams } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

/**
 * True when the server can't serve saved views: 501 (the storage has no
 * `savedViews` domain) or 404 (a server older than the saved-views routes).
 * Callers hide the feature instead of showing an error.
 */
export function isSavedViewsUnavailableError(error: unknown): boolean {
  return error instanceof MastraClientError && (error.status === 404 || error.status === 501);
}

/**
 * Lists every saved view for one Studio page, oldest first, following
 * `pagination.hasMore` across pages of 100. Never retries; check
 * `isSavedViewsUnavailableError(error)` to hide the feature.
 */
export const useSavedViews = <TData = SavedViewResponse[]>({
  page,
  queryOptions,
}: {
  page: string;
  queryOptions?: MastraQueryOptions<SavedViewResponse[], TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<SavedViewResponse[], Error, TData>({
    queryKey: ['saved-views', page],
    queryFn: async () => {
      const views: SavedViewResponse[] = [];
      for (let pageIndex = 0; ; pageIndex++) {
        const result = await client.listSavedViews({ page, pageIndex });
        // A server that ignores `pageIndex` answers the first page again, so stop instead of looping.
        if (result.pagination.page !== pageIndex) return views;
        views.push(...result.views);
        if (!result.pagination.hasMore || result.views.length === 0) return views;
      }
    },
    retry: false,
    ...queryOptions,
  });
};

export type UpdateSavedViewVariables = UpdateSavedViewParams & { savedViewId: string };

/** Creates a saved view and refreshes every `useSavedViews` list. */
export const useCreateSavedView = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<SavedViewResponse, CreateSavedViewParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<SavedViewResponse, Error, CreateSavedViewParams>({
    mutationFn: params => client.createSavedView(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
    ...queryOptions,
  });
};

/** Updates a saved view's name or state and refreshes every `useSavedViews` list. */
export const useUpdateSavedView = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<SavedViewResponse, UpdateSavedViewVariables> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<SavedViewResponse, Error, UpdateSavedViewVariables>({
    mutationFn: ({ savedViewId, ...patch }) => client.updateSavedView(savedViewId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
    ...queryOptions,
  });
};

/** Deletes a saved view by id and refreshes every `useSavedViews` list. */
export const useDeleteSavedView = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<{ deleted: true }, string> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<{ deleted: true }, Error, string>({
    mutationFn: savedViewId => client.deleteSavedView(savedViewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
    ...queryOptions,
  });
};
