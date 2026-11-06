import { queryOptions, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  deleteIntakeBinding,
  fetchIntakeBindings,
  fetchIntakeConfig,
  fetchIntakeLabelRoutes,
  saveIntakeBinding,
  saveIntakeLabelRoute,
  saveIntakeSelection,
  withIntakeBinding,
  withIntakeLabelRoute,
  withoutIntakeBinding,
} from '../ui/domains/factory/services/intake';
import type {
  IntakeBindingTarget,
  IntakeBindingWrite,
  IntakeConfig,
  IntakeLabelRoute,
  IntakeLabelRouteWrite,
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

/** GitHub label → board routes of one Factory project. */
export function useIntakeLabelRoutesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeLabelRoutes(factoryProjectId),
    queryFn: () => fetchIntakeLabelRoutes(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
  });
}

const configWrites = () => ['intake-write', 'config'] as const;
const selectionWrite = (integrationId: string) => [...configWrites(), integrationId] as const;
const bindingWrites = () => ['intake-write', 'bindings'] as const;
const labelRouteWrites = (factoryProjectId: string) => ['intake-write', 'label-routes', factoryProjectId] as const;

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

// The GitHub feed never reads intake config or bindings, so it has nothing to refresh.
function invalidateIssueFeed(queryClient: QueryClient, baseUrl: string, integrationId: string) {
  const feeds: Record<string, QueryKey> = {
    linear: queryKeys.linearIssuesAll(),
    jira: queryKeys.jiraIssuesAll(),
    gitlab: queryKeys.gitlabIssuesAll(baseUrl),
    incidentio: queryKeys.incidentioIssuesAll(),
  };
  const queryKey = feeds[integrationId];
  if (queryKey) void queryClient.invalidateQueries({ queryKey });
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
      invalidateIssueFeed(queryClient, baseUrl, integrationId);
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
      invalidateIssueFeed(queryClient, baseUrl, binding.integrationId);
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
      invalidateIssueFeed(queryClient, baseUrl, binding.integrationId);
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
      invalidateIssueFeed(queryClient, baseUrl, binding.integrationId);
      callbacks?.onSaved?.(binding);
    },
    onError: (error, binding) => {
      write.rollback();
      callbacks?.onFailed?.(error, binding);
    },
  });
}

export function useSaveIntakeLabelRouteMutation(
  factoryProjectId: string,
  callbacks?: IntakeWriteCallbacks<IntakeLabelRouteWrite>,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const write = serialWrite<IntakeLabelRoute[], IntakeLabelRouteWrite>(
    queryClient,
    queryKeys.intakeLabelRoutes(factoryProjectId),
    labelRouteWrites(factoryProjectId),
    (routes, route) => withIntakeLabelRoute(routes, { factoryProjectId, ...route }),
  );
  return useMutation({
    mutationKey: [...labelRouteWrites(factoryProjectId), 'save'],
    scope: write.scope,
    mutationFn: (route: IntakeLabelRouteWrite) => saveIntakeLabelRoute(baseUrl, { factoryProjectId, ...route }),
    onMutate: write.optimistic,
    onSuccess: (saved, route) => {
      write.settle(saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
      callbacks?.onSaved?.(route);
    },
    onError: (error, route, context) => {
      write.rollback(context?.previous);
      callbacks?.onFailed?.(error, route);
    },
  });
}

// Waits for the server: the form keeps what was typed when the server refuses it.
export function useAddIntakeLabelRouteMutation(
  factoryProjectId: string,
  callbacks?: IntakeWriteCallbacks<IntakeLabelRouteWrite>,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const write = serialWrite<IntakeLabelRoute[], IntakeLabelRouteWrite>(
    queryClient,
    queryKeys.intakeLabelRoutes(factoryProjectId),
    labelRouteWrites(factoryProjectId),
    (routes, route) => withIntakeLabelRoute(routes, { factoryProjectId, ...route }),
  );
  return useMutation({
    mutationKey: [...labelRouteWrites(factoryProjectId), 'add'],
    scope: write.scope,
    mutationFn: (route: IntakeLabelRouteWrite) => saveIntakeLabelRoute(baseUrl, { factoryProjectId, ...route }),
    onSuccess: (saved, route) => {
      write.confirm(saved, route);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
      callbacks?.onSaved?.(route);
    },
    onError: (error, route) => {
      write.rollback();
      callbacks?.onFailed?.(error, route);
    },
  });
}
