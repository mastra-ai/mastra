import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useMemory, useThreads } from '@mastra/react/hooks/memory';
import { Navigate } from 'react-router';
import { ResumeSavedChat } from './resume-saved-chat';

export function ResumeAgentChat({ agentId, threadId }: { agentId: string; threadId?: string }) {
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const memory = useMemory({ agentId, requestContext });
  const hasMemory = Boolean(memory.data?.result);
  const loadRecent = hasMemory && !threadId;
  const threads = useThreads({
    agentId,
    resourceId: agentId,
    isMemoryEnabled: hasMemory,
    requestContext,
    queryOptions: { enabled: loadRecent },
  });
  if (memory.isLoading || (loadRecent && threads.isLoading)) return <Spinner aria-label="Loading recent chats" />;
  if (memory.error || threads.error)
    return (
      <EmptyState
        tone="error"
        titleSlot="Could not load recent chats"
        descriptionSlot="Try again when the connection is restored."
      />
    );
  if (hasMemory && threadId && threadId !== 'new') return <ResumeSavedChat agentId={agentId} threadId={threadId} />;
  const latest = threads.data?.reduce<(typeof threads.data)[number] | undefined>(
    (latest, thread) => (!latest || new Date(thread.updatedAt) > new Date(latest.updatedAt) ? thread : latest),
    undefined,
  );
  const destination = threadId === 'new' ? 'new' : (latest?.id ?? 'new');
  return <Navigate replace to={`/agents/${encodeURIComponent(agentId)}/threads/${encodeURIComponent(destination)}`} />;
}
