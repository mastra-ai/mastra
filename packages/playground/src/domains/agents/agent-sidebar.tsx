import {
  AgentMemory,
  ChatThreads,
  Tabs,
  TabList,
  Tab,
  TabContent,
  useCloneThread,
  useDeleteThread,
  useLinkComponent,
} from '@mastra/playground-ui';
import type { ChatThreadsProps } from '@mastra/playground-ui';
import { useState } from 'react';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
}: {
  agentId: string;
  threadId: string;
  threads?: ChatThreadsProps['threads'];
  isLoading: boolean;
}) {
  const { mutateAsync } = useDeleteThread();
  const { mutateAsync: cloneThread } = useCloneThread();
  const { paths, navigate } = useLinkComponent();
  const [isCloningThreadId, setIsCloningThreadId] = useState<string | null>(null);

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId });
    if (deleteId === threadId) {
      navigate(paths.agentNewThreadLink(agentId));
    }
  };

  const handleClone = async (sourceThreadId: string) => {
    setIsCloningThreadId(sourceThreadId);

    try {
      const result = await cloneThread({ threadId: sourceThreadId, agentId });
      if (result?.thread?.id) {
        navigate(paths.agentThreadLink(agentId, result.thread.id));
      }
    } finally {
      setIsCloningThreadId(null);
    }
  };

  return (
    <Tabs defaultTab="conversations" className="flex flex-col h-full overflow-hidden">
      <TabList className="shrink-0 border-b border-border1 bg-surface2 px-2">
        <Tab value="conversations" className="!text-ui-sm !px-3 !py-2.5">
          Conversations
        </Tab>
        <Tab value="memory" className="!text-ui-sm !px-3 !py-2.5">
          Memory
        </Tab>
      </TabList>

      <TabContent value="conversations" className="flex-1 overflow-y-auto py-0">
        <ChatThreads
          resourceId={agentId}
          resourceType={'agent'}
          threads={threads || []}
          isLoading={isLoading}
          threadId={threadId}
          onDelete={handleDelete}
          onClone={handleClone}
          isCloningThreadId={isCloningThreadId}
        />
      </TabContent>

      <TabContent value="memory" className="flex-1 overflow-y-auto py-0">
        <AgentMemory agentId={agentId} threadId={threadId} />
      </TabContent>
    </Tabs>
  );
}
