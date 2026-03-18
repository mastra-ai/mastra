import {
  AgentMemory,
  Button,
  ChatThreads,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
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
    <div className="h-full">
      <div className="px-3 py-2 border-b border-border1 bg-surface2">
        <Button variant="outline" className="w-full" onClick={() => setIsMemoryOpen(true)}>
          Memory
        </Button>
      </div>

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

      <Dialog open={isMemoryOpen} onOpenChange={setIsMemoryOpen}>
        <DialogContent className="max-w-[860px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Memory</DialogTitle>
          </DialogHeader>
          <DialogBody className="p-0 max-h-[70vh] overflow-y-auto">
            <AgentMemory agentId={agentId} threadId={threadId} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
