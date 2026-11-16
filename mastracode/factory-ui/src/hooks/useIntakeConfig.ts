import { queryOptions, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  deleteIntakeBinding,
  fetchIntakeBindings,
  fetchIntakeConfig,
  saveIntakeBinding,
  saveIntakeSelection,
  withIntakeBinding,
  withoutIntakeBinding,
} from '../ui/domains/factory/services/intake';
import type {
  IntakeBindingTarget,
  IntakeBindingWrite,
  IntakeConfig,
  IntakeSelection,
  IntakeSourceBinding,
} from '../ui/domains/factory/services/intake';

/** The org's intake source configuration (Settings › Intake). */
export function intakeConfigQueryOptions(baseUrl: string) {
  return queryOptions({ queryKey: queryKeys.intakeConfig(), queryFn: () => fetchIntakeConfig(baseUrl) });
}

export function useIntakeConfigQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...intakeConfigQueryOptions(baseUrl), enabled });
}

/** Which Factory project each intake source routes into (org-wide). */
export function intakeBindingsQueryOptions(baseUrl: string) {
  return queryOptions({ queryKey: queryKeys.intakeBindings(), queryFn: () => fetchIntakeBindings(baseUrl) });
}

export function useIntakeBindingsQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...intakeBindingsQueryOptions(baseUrl), enabled });
}

const configWrites = () => ['intake-write', 'config'] as const;
const selectionWrite = (integrationId: string) => [...configWrites(), integrationId] as const;
const bindingWrites = () => ['intake-write', 'bindings'] as const;

export interface IntakeWriteCallbacks<TVariables> {
  onSaved?: (variables: TVariables) => void;
  onFailed?: (error: Error, variables: TVariables) => void;
}

// One write at a time per cache; only the last in flight takes the server's answer, so an older answer never undoes a newer change.
function serialWrite<TCache, TVariables>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  writeKey: readonly string[],
  apply: (cache: TCache, variables: TVariables) => TCache,
) {
  const lastInFlight = () => queryClient.isMutating({ mutationKey: writeKey }) === 1;
  const patch = (variables: TVariables) =>
    queryClient.setQueryData<TCache>(queryKey, cache => (cache === undefined ? undefined : apply(cache, variables)));
  return {
    scope: { id: writeKey.join('/') },
    optimistic: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<TCache>(queryKey);
      patch(variables);
      return { previous };
    },
    settle: (saved: TCache) => {
      if (lastInFlight()) queryClient.setQueryData(queryKey, saved);
    },
    confirm: (saved: TCache, variables: TVariables) => {
      if (lastInFlight()) queryClient.setQueryData(queryKey, saved);
      else patch(variables);
    },
    rollback: (previous?: TCache) => {
      if (!lastInFlight()) return;
      if (previous !== undefined) queryClient.setQueryData(queryKey, previous);
      void queryClient.invalidateQueries({ queryKey, exact: true });
    },
  };
}

export function useSaveIntakeSelectionMutation(
  integrationId: string,
  callbacks?: IntakeWriteCallbacks<IntakeSelection>,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const write = serialWrite<IntakeConfig, IntakeSelection>(
    queryClient,
    queryKeys.intakeConfig(),
    configWrites(),
    (config, selection) => ({ ...config, [integrationId]: selection }),
  );
  return useMutation({
    mutationKey: selectionWrite(integrationId),
    scope: write.scope,
    mutationFn: (selection: IntakeSelection) => saveIntakeSelection(baseUrl, integrationId, selection),
    onMutate: write.optimistic,
    onSuccess: (saved, selection) => {
      write.settle(saved);
      callbacks?.onSaved?.(selection);
    },
    onError: (error, selection, context) => {
      write.rollback(context?.previous);
      callbacks?.onFailed?.(error, selection);
    },
  });
}

export function useIntakeSelectionSaving(integrationId: string): boolean {
  return useIsMutating({ mutationKey: selectionWrite(integrationId) }) > 0;
}

export function useSaveIntakeBindingMutation(callbacks?: IntakeWriteCallbacks<IntakeBindingWrite>) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const write = serialWrite<IntakeSourceBinding[], IntakeBindingWrite>(
    queryClient,
    queryKeys.intakeBindings(),
    bindingWrites(),
    withIntakeBinding,
  );
  return useMutation({
    mutationKey: [...bindingWrites(), 'save'],
    scope: write.scope,
    mutationFn: (binding: IntakeBindingWrite) => saveIntakeBinding(baseUrl, binding),
    onMutate: write.optimistic,
    onSuccess: (saved, binding) => {
      write.settle(saved);
      callbacks?.onSaved?.(binding);
    },
    onError: (error, binding, context) => {
      write.rollback(context?.previous);
      callbacks?.onFailed?.(error, binding);
    },
  });
}

export function useDeleteIntakeBindingMutation(callbacks?: IntakeWriteCallbacks<IntakeBindingTarget>) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const write = serialWrite<IntakeSourceBinding[], IntakeBindingTarget>(
    queryClient,
    queryKeys.intakeBindings(),
    bindingWrites(),
    withoutIntakeBinding,
  );
  return useMutation({
    mutationKey: [...bindingWrites(), 'delete'],
    scope: write.scope,
    mutationFn: (binding: IntakeBindingTarget) => deleteIntakeBinding(baseUrl, binding),
    onMutate: write.optimistic,
    onSuccess: (saved, binding) => {
      write.settle(saved);
      callbacks?.onSaved?.(binding);
    },
    onError: (error, binding, context) => {
      write.rollback(context?.previous);
      callbacks?.onFailed?.(error, binding);
    },
  });
}

// Waits for the server: the form keeps what was typed when the server refuses it.
export function useAddIntakeBindingMutation(callbacks?: IntakeWriteCallbacks<IntakeBindingWrite>) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const write = serialWrite<IntakeSourceBinding[], IntakeBindingWrite>(
    queryClient,
    queryKeys.intakeBindings(),
    bindingWrites(),
    withIntakeBinding,
  );
  return useMutation({
    mutationKey: [...bindingWrites(), 'add'],
    scope: write.scope,
    mutationFn: (binding: IntakeBindingWrite) => saveIntakeBinding(baseUrl, binding),
    onSuccess: (saved, binding) => {
      write.confirm(saved, binding);
      callbacks?.onSaved?.(binding);
    },
    onError: (error, binding) => {
      write.rollback();
      callbacks?.onFailed?.(error, binding);
    },
  });
}
