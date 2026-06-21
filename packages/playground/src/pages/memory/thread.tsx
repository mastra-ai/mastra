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

export default function MemoryThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();

  const { data: thread, isLoading: isThreadLoading, error } = useMemoryThread(threadId);
  const { data: messagesData, isLoading: isMessagesLoading } = useMemoryThreadMessages(threadId);
  const { data: omData, isLoading: isOMLoading } = useObservationalMemory(undefined, threadId);

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
