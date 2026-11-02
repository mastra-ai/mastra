import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { setUserSessionVisibility } from '../services/user-sessions';
import type { UserSessionVisibility } from '../services/user-sessions';

export function useSessionVisibility(factoryId: string, sessionId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const mutationKey = ['session-visibility', sessionId];
  const changing = useIsMutating({ mutationKey }) > 0;
  const { mutateAsync } = useMutation({
    mutationKey,
    mutationFn: (visibility: UserSessionVisibility) => setUserSessionVisibility(baseUrl, sessionId, visibility),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(sessionId) });
    },
  });
  return { changeVisibility: mutateAsync, changing };
}
