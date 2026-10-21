import type { CreateSavedViewParams, SavedViewResponse, UpdateSavedViewParams } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

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
}: { queryOptions?: MastraMutationOptions<{ message: string }, string> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: savedViewId => client.deleteSavedView(savedViewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-views'] });
    },
    ...queryOptions,
  });
};
