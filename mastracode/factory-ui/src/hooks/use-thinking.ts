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

function applyThinkingUpdates(config: ThinkingConfigInfo, args: UpdateThinkingArgs): ThinkingConfigInfo {
  const modeDefaults = { ...config.modeDefaults };
  for (const [mode, level] of Object.entries(args.modeDefaults ?? {})) {
    if (level === null) delete modeDefaults[mode];
    else modeDefaults[mode] = level;
  }
  return { ...config, globalDefault: args.globalDefault ?? config.globalDefault, modeDefaults };
}

/** Optimistic: the slider holds the dropped level, a rejection puts it back. */
export function useUpdateThinkingMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  const key = queryKeys.thinkingConfig();

  return useMutation({
    // Base and per-mode rows write the same file: run them one at a time so a
    // rollback restores the value before that write, not before its neighbour's.
    scope: { id: 'thinking-config' },
    mutationFn: (args: UpdateThinkingArgs) => client.put<UpdateThinkingConfigResponse>('/web/config/thinking', args),
    onMutate: async args => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<ThinkingConfigInfo>(key);
      if (previous) queryClient.setQueryData<ThinkingConfigInfo>(key, applyThinkingUpdates(previous, args));
      return { previous };
    },
    onError: (_error, _args, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: res =>
      queryClient.setQueryData<ThinkingConfigInfo>(key, prev =>
        prev ? { ...prev, globalDefault: res.globalDefault, modeDefaults: res.modeDefaults } : prev,
      ),
  });
}
