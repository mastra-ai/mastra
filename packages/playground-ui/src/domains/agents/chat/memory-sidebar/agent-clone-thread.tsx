import { useCloneThread } from '@mastra/react/hooks/memory';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconFork } from '@/ds/icons/central/IconFork';
import { toast } from '@/utils/toast';

export interface AgentCloneThreadProps {
  agentId: string;
  threadId: string;
  /** Host navigation to the copy. */
  onCloned: (threadId: string) => void;
}

export function AgentCloneThread({ agentId, threadId, onCloned }: AgentCloneThreadProps) {
  const { mutateAsync: cloneThread, isPending: isCloning } = useCloneThread();

  const handleCloneThread = async () => {
    let result;
    try {
      result = await cloneThread({ threadId, agentId });
    } catch {
      toast.error('Failed to clone thread');
      return;
    }
    toast.success('Thread cloned successfully');
    if (result?.thread?.id) onCloned(result.thread.id);
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <Txt as="h3" variant="subheading" tone="ink">
          Clone Thread
        </Txt>
        <Txt variant="caption" tone="muted" className="mt-1">
          Create a copy of this conversation
        </Txt>
      </div>
      <Button onClick={handleCloneThread} disabled={isCloning} icon={<IconFork />}>
        {isCloning ? 'Cloning...' : 'Clone'}
      </Button>
    </div>
  );
}
