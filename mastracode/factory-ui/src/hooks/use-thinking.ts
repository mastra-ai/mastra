import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ThinkingConfigInfo, UpdateThinkingConfigResponse } from '../api/types';

export type ThinkingLevelValue = ThinkingConfigInfo['globalDefault'];

/** Deployment-wide thinking default every run without a session override uses. Mirrors `GET/PUT /web/config/thinking`. */
export function useThinkingConfigQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  return useQuery<ThinkingConfigInfo>({
    queryKey: queryKeys.thinkingConfig(),
    queryFn: () => client.get<ThinkingConfigInfo>('/web/config/thinking'),
    enabled,
  });
}

export interface UpdateThinkingArgs {
  globalDefault: ThinkingLevelValue;
}

/** Optimistic: the slider holds the dropped level, a rejection puts it back. */
export function useUpdateThinkingMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  const key = queryKeys.thinkingConfig();

  return useMutation({
    // One write at a time, so a rollback restores the value before that write.
    scope: { id: 'thinking-config' },
    mutationFn: (args: UpdateThinkingArgs) => client.put<UpdateThinkingConfigResponse>('/web/config/thinking', args),
    onMutate: async args => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<ThinkingConfigInfo>(key);
      if (previous)
        queryClient.setQueryData<ThinkingConfigInfo>(key, { ...previous, globalDefault: args.globalDefault });
      return { previous };
    },
    onError: (_error, _args, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: res =>
      queryClient.setQueryData<ThinkingConfigInfo>(key, prev =>
        prev ? { ...prev, globalDefault: res.globalDefault } : prev,
      ),
  });
}
