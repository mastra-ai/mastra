import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useThread } from '@mastra/react/hooks/memory';
import { Navigate } from 'react-router';

/** Look up the saved thread directly: it may no longer be on the first history page. */
export function ResumeSavedChat({ agentId, threadId }: { agentId: string; threadId: string }) {
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const thread = useThread({ agentId, threadId, requestContext, queryOptions: { staleTime: 0 } });
  if (thread.isLoading) return <Spinner aria-label="Loading last conversation" />;
  if (thread.error && !is404NotFoundError(thread.error)) {
    return (
      <EmptyState
        tone="error"
        titleSlot="Could not load the last conversation"
        descriptionSlot={thread.error.message}
        actionSlot={<Button onClick={() => void thread.refetch()}>Try again</Button>}
      />
    );
  }
  const destination = thread.data?.resourceId === agentId ? thread.data.id : 'new';
  return <Navigate replace to={`/agents/${encodeURIComponent(agentId)}/threads/${encodeURIComponent(destination)}`} />;
}
