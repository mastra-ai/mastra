import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  deleteSandboxEnv,
  listSandboxEnvs,
  setSandboxEnv,
  updateSandboxEnvAppliesTo,
} from '../ui/domains/workspaces/services/sandbox-envs';
import type { SandboxEnvAppliesTo } from '../ui/domains/workspaces/services/sandbox-envs';

/** A Factory's sandbox environment variables (names and settings only). Idle without a factory id. */
export function useSandboxEnvsQuery(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySandboxEnvs(factoryId),
    queryFn: () => listSandboxEnvs(baseUrl, factoryId!),
    enabled: Boolean(factoryId),
  });
}

/** Add, replace, re-scope or delete one variable; each refetches the list. */
export function useSandboxEnvMutations(factoryId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: queryKeys.factorySandboxEnvs(factoryId) });
  return {
    set: useMutation({
      mutationFn: (input: { name: string; value: string; appliesTo: SandboxEnvAppliesTo }) =>
        setSandboxEnv(baseUrl, factoryId, input),
      onSuccess,
    }),
    updateAppliesTo: useMutation({
      mutationFn: (input: { name: string; appliesTo: SandboxEnvAppliesTo }) =>
        updateSandboxEnvAppliesTo(baseUrl, factoryId, input),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (name: string) => deleteSandboxEnv(baseUrl, factoryId, name),
      onSuccess,
    }),
  };
}
