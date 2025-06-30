import { Threads, ThreadList, ThreadItem, ThreadLink, ThreadDeleteButton } from '@/components/threads';
import { AlertDialog } from '@/components/ui/elements';
import { Txt } from '@/ds/components/Txt';
import { Plus } from 'lucide-react';
import { format } from 'date-fns/format';

type AgentPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  linkComponent?: any;
  agentId: string;
  threads: any[];
  threadId: string;
  onDelete: (threadId: string | null) => void;
  onDeleteConfirm: () => void;
  threadToDelete: string | null;
};

export function AgentHistory({
  agentId,
  threads,
  threadId,
  linkComponent,
  onDelete,
  onDeleteConfirm,
  threadToDelete,
}: AgentPanelProps) {
  const handleDelete = (threadId: string) => {
    onDelete(threadId);
  };

  const handleDeleteCancel = () => {
    onDelete(null);
  };

  const handleDeleteConfirm = () => {
    onDeleteConfirm();
  };

  return (
    <div>
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink as={linkComponent} to={`/agents/${agentId}/chat/}`}>
              <span className="text-accent1 flex items-center gap-4">
                <Plus />
                New Chat
              </span>
            </ThreadLink>
          </ThreadItem>

          {threads.length === 0 && (
            <Txt as="p" variant="ui-sm" className="text-icon3 py-3 px-5">
              Your conversations will appear here
              <br /> once you start chatting!
            </Txt>
          )}

          {threads.map(thread => {
            const isActive = thread.id === threadId;

            return (
              <ThreadItem isActive={isActive} key={thread.id}>
                <ThreadLink as={linkComponent} to={`/agents/${agentId}/chat/${thread.id}`}>
                  <span className="text-muted-foreground">Chat from</span>
                  <span>{format(new Date(thread.createdAt), "MMM d 'at' h:mm:ss a")}</span>
                </ThreadLink>

                <ThreadDeleteButton onClick={() => handleDelete(thread.id)} />
              </ThreadItem>
            );
          })}
        </ThreadList>
      </Threads>

      <AlertDialog open={!!threadToDelete} onOpenChange={handleDeleteCancel}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
            <AlertDialog.Description>
              This action cannot be undone. This will permanently delete your chat and remove it from our servers.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDeleteConfirm}>Continue</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}
