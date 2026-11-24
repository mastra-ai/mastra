import { hashKey, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

export function useOptimisticFieldWrite<TData extends object, F extends keyof TData & string, TResponse>({
  queryKey,
  field,
  write,
  savedValue,
  onSaved,
}: {
  queryKey: QueryKey;
  field: F;
  write: (value: Exclude<TData[F], undefined>) => Promise<TResponse>;
  savedValue: (response: TResponse) => TData[F];
  onSaved?: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const mutationKey = [...queryKey, 'field', field];
  const pendingValues = useMutationState({
    filters: { mutationKey, exact: true, status: 'pending' },
    select: mutation => mutation.state.variables as Exclude<TData[F], undefined>,
  });
  const mutation = useMutation({
    mutationKey,
    scope: { id: hashKey(mutationKey) },
    mutationFn: write,
    onMutate: () => queryClient.cancelQueries({ queryKey, exact: true }),
    onSuccess: response => {
      queryClient.setQueryData<TData>(queryKey, current =>
        current ? { ...current, [field]: savedValue(response) } : current,
      );
      return onSaved?.();
    },
  });
  const newestPending = pendingValues.at(-1);
  return {
    ...mutation,
    pendingOr: <S>(saved: S) => (newestPending === undefined ? saved : newestPending),
  };
}
