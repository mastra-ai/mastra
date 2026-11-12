import { toast } from '@mastra/playground-ui/components/Toaster';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { answerParkedPlan } from '../services/user-sessions';

/** Answers the plan a followed card's phase session waits on, from the row of the session following it. */
export function useAnswerParkedPlan(factoryId: string, sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const mutationKey = ['answer-parked-plan', sessionId];
  const answering = useIsMutating({ mutationKey }) > 0;
  const { mutate } = useMutation({
    mutationKey,
    mutationFn: (decision: 'approve' | 'decline') => {
      if (!sessionId) throw new Error('No plan is waiting.');
      return answerParkedPlan(baseUrl, sessionId, decision);
    },
    onSuccess: (_, decision) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) });
      toast(decision === 'approve' ? 'Plan approved' : 'Plan declined');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to answer the plan'),
  });
  return { answer: sessionId ? mutate : undefined, answering };
}
