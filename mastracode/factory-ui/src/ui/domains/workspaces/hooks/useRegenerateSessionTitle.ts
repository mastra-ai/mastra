import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { regenerateSessionTitle } from '../services/user-sessions';
import type { FactoryUserSession } from '../services/user-sessions';

export function useRegenerateSessionTitle(factoryId: string | undefined): {
  regenerate: (session: FactoryUserSession) => void;
  regenerating: ReadonlySet<string>;
} {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState<ReadonlySet<string>>(new Set());
  const regenerateTitle = useMutation({
    mutationFn: (session: FactoryUserSession) => regenerateSessionTitle(baseUrl, session.sessionId),
    onMutate: session => setRegenerating(current => new Set(current).add(session.sessionId)),
    onSuccess: title => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
      toast(`Renamed to “${title}”`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to regenerate title'),
    onSettled: (_title, _error, session) =>
      setRegenerating(current => {
        const next = new Set(current);
        next.delete(session.sessionId);
        return next;
      }),
  });

  return { regenerate: regenerateTitle.mutate, regenerating };
}
