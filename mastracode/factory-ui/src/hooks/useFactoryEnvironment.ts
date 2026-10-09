import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  getEnvironmentBuild,
  getFactoryEnvironment,
  listEnvironmentBuilds,
  patchFactoryEnvironment,
  requestEnvironmentBuild,
} from '../ui/domains/workspaces/services/environment';
import type {
  FactoryEnvironmentBuild,
  FactoryEnvironmentPatch,
  FactoryEnvironmentPayload,
} from '../ui/domains/workspaces/services/environment';

/**
 * A Factory's environment (resources, ordered repositories and setup) through
 * the shared React Query cache. Idle without a factory id.
 */
export function useFactoryEnvironmentQuery(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryEnvironment(factoryId),
    queryFn: () => getFactoryEnvironment(baseUrl, factoryId!),
    enabled: Boolean(factoryId),
  });
}

/**
 * Persist environment changes. The response carries the whole environment, so
 * the cache is replaced from it and then refetched: the PATCH is not
 * transactional, so a half-applied save shows up as what the server really
 * holds. The factory query is invalidated because its repository list mirrors
 * part of the environment.
 */
export function useSaveFactoryEnvironmentMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, input }: { factoryId: string; input: FactoryEnvironmentPatch }) =>
      patchFactoryEnvironment(baseUrl, factoryId, input),
    onSuccess: (saved, { factoryId }) => {
      queryClient.setQueryData(queryKeys.factoryEnvironment(factoryId), saved.environment);
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironment(factoryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryProject(factoryId) });
    },
  });
}

/** Build the environment template now; the environment and the history refetch so the new build id shows. */
export function useRequestEnvironmentBuildMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId }: { factoryId: string }) => requestEnvironmentBuild(baseUrl, factoryId),
    onSuccess: (_started, { factoryId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironment(factoryId) });
    },
  });
}

const ACTIVE_BUILD_POLL_MS = 10_000;
/** The workflow pins the template on its own 15 s poll after the provider reports ready. */
const PIN_WAIT_POLL_MS = 5_000;
const PIN_WAIT_MAX_POLLS = 12;

function isActive(build: FactoryEnvironmentBuild | undefined) {
  return build?.status === 'pending' || build?.status === 'building';
}

/**
 * Live status of one build, polled every 10 s only while it is pending or
 * building. The environment query itself never polls; when the build settles
 * the environment refetches, and keeps refetching every 5 s (for up to a
 * minute) while a ready build's template is not yet the pinned one, because
 * the workflow writes the pin on its own poll after the provider says ready.
 */
export function useEnvironmentBuildQuery(factoryId: string | undefined, buildId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const pinPolls = useRef(0);
  const awaitingPin = (build: FactoryEnvironmentBuild | undefined) => {
    if (build?.status !== 'ready' || !build.templateId) return false;
    const environment = queryClient.getQueryData<FactoryEnvironmentPayload>(queryKeys.factoryEnvironment(factoryId));
    return environment !== undefined && environment.activeTemplateId !== build.templateId;
  };
  return useQuery({
    queryKey: queryKeys.factoryEnvironmentBuild(factoryId, buildId),
    queryFn: async () => {
      const previous = queryClient.getQueryData<FactoryEnvironmentBuild>(
        queryKeys.factoryEnvironmentBuild(factoryId, buildId),
      );
      const build = await getEnvironmentBuild(baseUrl, factoryId!, buildId!);
      if (isActive(previous) && !isActive(build)) {
        pinPolls.current = 0;
        void queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironment(factoryId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironmentBuilds(factoryId) });
      } else if (awaitingPin(build)) {
        pinPolls.current += 1;
        void queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironment(factoryId) });
      }
      return build;
    },
    enabled: Boolean(factoryId && buildId),
    refetchInterval: query => {
      if (isActive(query.state.data)) return ACTIVE_BUILD_POLL_MS;
      if (awaitingPin(query.state.data) && pinPolls.current < PIN_WAIT_MAX_POLLS) return PIN_WAIT_POLL_MS;
      return false;
    },
  });
}

/** The provider's build history, newest first; only asked for when the provider keeps one. */
export function useEnvironmentBuildsQuery(factoryId: string | undefined, enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryEnvironmentBuilds(factoryId),
    queryFn: () => listEnvironmentBuilds(baseUrl, factoryId!),
    enabled: Boolean(factoryId) && enabled,
  });
}
