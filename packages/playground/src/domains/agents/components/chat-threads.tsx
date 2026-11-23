import type { StorageThreadType } from '@mastra/core/memory';
import { useThreadsPanel } from '@mastra/playground-ui/domains/agents/chat';
import { ChatThreads as SharedChatThreads } from '@mastra/playground-ui/domains/agents/chat/chat-threads';
import { RenameThreadDialog } from './rename-thread-dialog';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export interface ChatThreadsProps {
  threads: StorageThreadType[];
  threadId: string;
  onDelete: (threadId: string) => void;
  resourceId: string;
  resourceType: 'agent' | 'network';
  embedded?: boolean;
  isLoading?: boolean;
}

export function ChatThreads(props: ChatThreadsProps) {
  const { canDelete, canEdit } = usePermissions();
  const threadsPanel = useThreadsPanel();

  return (
    <SharedChatThreads
      {...props}
      canDeleteThread={canDelete('memory')}
      canRenameThread={props.resourceType === 'agent' && canEdit('memory')}
      onHidePanel={threadsPanel?.collapse}
      onCollapseEmpty={threadsPanel?.collapseOnce}
      renderRenameDialog={(thread, onClose) => (
        <RenameThreadDialog
          agentId={props.resourceId}
          threadId={thread.id}
          initialTitle={thread.title ?? ''}
          onOpenChange={open => !open && onClose()}
        />
      )}
    />
  );
}
