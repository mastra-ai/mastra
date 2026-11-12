import type { BackgroundTaskResponse } from '@mastra/client-js';
import { skipToken, useQuery } from '@tanstack/react-query';
import { isDeferredCall, isStoppedBackgroundCall } from '../tool-card-kind';
import { backgroundTaskQueryKey } from './use-deferred-input-request';

/**
 * A deferred call's status, corrected by its task once the task was stopped. Cancelling from the
 * dock after the turn ended starts no run, so the chat keeps the call's `running` part until its
 * messages are read again; the cancel response already sits in the task's cache entry, read here
 * without a request of its own.
 */
export function useBackgroundTaskStatus(
  backgroundTaskId: string | undefined,
  partStatus: string | undefined,
): string | undefined {
  const { data } = useQuery<BackgroundTaskResponse>({
    // Must match the key `useCancelBackgroundTask` in `@mastra/react` writes the cancelled task to.
    queryKey: backgroundTaskQueryKey(backgroundTaskId ?? ''),
    queryFn: skipToken,
  });
  const stopped =
    isDeferredCall(backgroundTaskId, partStatus) && isStoppedBackgroundCall(backgroundTaskId, data?.status);
  return stopped ? data?.status : partStatus;
}
