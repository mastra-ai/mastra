import { useMemo } from 'react';
import {
  NoDataPageLayout,
  ErrorState,
  PageLayout,
  ThreadDetailView,
  useMemoryThread,
  useMemoryThreadMessages,
  useObservationalMemory,
} from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';
import { useLinkComponent } from '@/lib/framework';
import { useAgents } from '@/domains/agents/hooks/use-agents';

export default function MemoryThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();

  const { data: agentsMap } = useAgents();
  const firstAgentId = useMemo(() => {
    if (!agentsMap) return undefined;
    const ids = Object.keys(agentsMap);
    return ids.length > 0 ? ids[0] : undefined;
  }, [agentsMap]);

  const { data: thread, isLoading: isThreadLoading, error } = useMemoryThread(threadId);
  const { data: messagesData, isLoading: isMessagesLoading } = useMemoryThreadMessages(threadId);
  const { data: omData, isLoading: isOMLoading } = useObservationalMemory(firstAgentId, threadId);

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Thread not found" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout height="full">
      <ThreadDetailView
        thread={thread}
        messages={messagesData?.messages ?? []}
        omRecords={omData?.history ?? []}
        isThreadLoading={isThreadLoading}
        isMessagesLoading={isMessagesLoading}
        isOMLoading={isOMLoading}
        onBack={() => navigate('/memory')}
        backHref="/memory"
        LinkComponent={Link}
      />
    </PageLayout>
  );
}
