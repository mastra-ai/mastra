import type { MastraClient, CreateStoredScorerParams, UpdateStoredScorerParams } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

type StoredScorerResponse = Awaited<ReturnType<ReturnType<MastraClient['getStoredScorer']>['details']>>;
type DeleteStoredScorerResponse = Awaited<ReturnType<ReturnType<MastraClient['getStoredScorer']>['delete']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useStoredScorer = <TData = StoredScorerResponse | null>({
  scorerId,
  status,
  requestContext,
  queryOptions,
}: {
  scorerId?: string;
  status?: 'draft' | 'published';
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<StoredScorerResponse | null, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<StoredScorerResponse | null, Error, TData>({
    queryKey: ['stored-scorer', scorerId, status, requestContext],
    queryFn: () => (scorerId ? client.getStoredScorer(scorerId).details(requestContext, { status }) : null),
    ...queryOptions,
  });
};

export const useStoredScorerMutations = ({
  scorerId,
  requestContext,
  queryOptions,
}: {
  scorerId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: {
    createStoredScorer?: MastraMutationOptions<StoredScorerResponse, CreateStoredScorerParams>;
    updateStoredScorer?: MastraMutationOptions<StoredScorerResponse, UpdateStoredScorerParams>;
    deleteStoredScorer?: MastraMutationOptions<DeleteStoredScorerResponse, void>;
  };
} = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredScorerParams) => client.createStoredScorer(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
    },
    ...queryOptions?.createStoredScorer,
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredScorerParams) => {
      if (!scorerId) throw new Error('scorerId is required for update');
      return client.getStoredScorer(scorerId).update(params, requestContext);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
      if (scorerId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
      }
    },
    ...queryOptions?.updateStoredScorer,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!scorerId) throw new Error('scorerId is required for delete');
      return client.getStoredScorer(scorerId).delete(requestContext);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
      if (scorerId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
      }
    },
    ...queryOptions?.deleteStoredScorer,
  });

  return {
    createStoredScorer: createMutation,
    updateStoredScorer: updateMutation,
    deleteStoredScorer: deleteMutation,
  };
};
