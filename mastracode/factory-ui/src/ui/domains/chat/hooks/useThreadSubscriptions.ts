import { useSessionHost } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import type { ChangeRequestProvider, PullRequestSubscription } from '@internal/factory-contract';
import { useChatSessionContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatSessionContext';

const NO_SUBSCRIPTIONS: PullRequestSubscription[] = [];
const NO_QUERY = { data: undefined, isPending: false, isLoadingError: false };
const noPullRequestSubscriptions = () => NO_QUERY;

export function useThreadSubscriptions(
  threadId: string | undefined,
  enabled: boolean,
  provider: ChangeRequestProvider = 'github',
) {
  const { sessionId } = useChatSessionContext();
  const usePullRequestSubscriptions = useSessionHost().data.pullRequestSubscriptions?.use ?? noPullRequestSubscriptions;
  const active = enabled && Boolean(threadId);
  const query = usePullRequestSubscriptions(sessionId, threadId, provider, active);
  return {
    subscriptions: query.data ?? NO_SUBSCRIPTIONS,
    pending: active && query.isPending,
    failed: active && query.isLoadingError,
  };
}
