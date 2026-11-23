import { hashKey, useMutation, useQueryClient } from '@tanstack/react-query';
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
  write: (value: TData[F]) => Promise<TResponse>;
  savedValue: (response: TResponse) => TData[F];
  onSaved?: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const mutationKey = [...queryKey, 'field', field];
  // `onMutate` runs before scope serialization, so only the last write in flight may settle the field.
  const isLastWrite = () => queryClient.isMutating({ mutationKey, exact: true }) === 1;
  const setField = (value: TData[F]) =>
    queryClient.setQueryData<TData>(queryKey, current => (current ? { ...current, [field]: value } : current));

  return useMutation({
    mutationKey,
    scope: { id: hashKey(mutationKey) },
    mutationFn: write,
    onMutate: async value => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<TData>(queryKey);
      setField(value);
      return previous ? { restore: previous[field] } : undefined;
    },
    onError: (_error, _value, context) => {
      if (!isLastWrite()) return;
      if (context) setField(context.restore);
      return queryClient.invalidateQueries({ queryKey, exact: true });
    },
    onSuccess: response => {
      if (isLastWrite()) setField(savedValue(response));
      return onSaved?.();
    },
  });
}
