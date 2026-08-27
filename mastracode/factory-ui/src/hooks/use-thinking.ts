import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ThinkingConfigInfo, UpdateThinkingConfigResponse } from '../api/types';

export type ThinkingLevelValue = ThinkingConfigInfo['globalDefault'];

/**
 * Deployment-scoped thinking (reasoning-effort) defaults — the global default
 * plus per-mode overrides that request-time resolution falls back to when a
 * session carries no explicit override. Mirrors `GET/PUT /web/config/thinking`.
 *
 * The mutation returns the refreshed defaults, so it patches the cache via
 * `setQueryData` instead of refetching.
 */
export function useThinkingConfigQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  return useQuery<ThinkingConfigInfo>({
    queryKey: queryKeys.thinkingConfig(),
    queryFn: () => client.get<ThinkingConfigInfo>('/web/config/thinking'),
    enabled,
  });
}

export interface UpdateThinkingArgs {
  globalDefault?: ThinkingLevelValue;
  /** A level sets the mode's default; `null` clears it back to the global default. */
  modeDefaults?: Record<string, ThinkingLevelValue | null>;
}

export function useUpdateThinkingMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: UpdateThinkingArgs) => client.put<UpdateThinkingConfigResponse>('/web/config/thinking', args),
    onSuccess: res =>
      queryClient.setQueryData<ThinkingConfigInfo>(queryKeys.thinkingConfig(), prev =>
        prev ? { ...prev, globalDefault: res.globalDefault, modeDefaults: res.modeDefaults } : prev,
      ),
  });
}
