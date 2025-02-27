import { v4 as uuid } from '@lukeed/uuid';
import { Ellipsis, Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AlertDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import { useDeleteThread } from '@/hooks/use-memory';
import { StorageThreadType } from '@mastra/core';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
}) {
  const { deleteThread } = useDeleteThread();
  const navigate = useNavigate();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    await deleteThread({ threadId: deleteId!, resourceid: agentId, agentId });
    setShowDeleteDialog(false);
    if (deleteId === threadId) {
      navigate(`/agents/${agentId}/chat/${uuid()}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 w-full h-full space-y-2">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
    );
  }

  if (!threads?.length) {
    return (
      <div className="p-4 w-full space-y-2 h-full">
        <div className="flex justify-between items-center">
          <div className="text-sm text-mastra-el-5">Chat history</div>
          <Button variant="primary" size="icon" onClick={() => navigate(`/agents/${agentId}/chat/${uuid()}`)}>
            <Plus />
          </Button>
        </div>
        <div className="text-sm text-mastra-el-3">Your conversations will appear here once you start chatting!</div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full px-4 pb-4 w-[256px]">
      <div className="space-y-2">
        <div className="flex justify-between items-center pl-2 sticky top-0 pt-4">
          <div className="text-sm text-mastra-el-5">Chat history</div>
          <Button variant="primary" size="icon" onClick={() => navigate(`/agents/${agentId}/chat/${uuid()}`)}>
            <Plus />
          </Button>
        </div>
        {threads.map(thread => {
          const isActive = thread.id === threadId;
          return (
            <div
              className={cn(
                'flex cursor-pointer w-full px-2 items-center focus-visible:outline-none transition-colors  focus-visible:ring-1 focus-visible:ring-mastra-border-4 gap-3 rounded-sm group text-sm hover:bg-mastra-el-6/5',
                isActive ? 'bg-mastra-el-6/5' : '',
              )}
              key={thread.id}
            >
              <Link to={`/agents/${agentId}/chat/${thread.id}`} className="flex-1">
                <p
                  className={cn(
                    'py-[0.38rem] text-mastra-el-6/60 group-hover:text-mastra-el-6 transition-all text-sm  capitalize ',
                    isActive ? 'text-mastra-el-6' : '',
                  )}
                >
                  {thread.title}
                </p>
              </Link>

              <Dropdown>
                <Dropdown.Trigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <Ellipsis />
                    <span className="sr-only">More</span>
                  </Button>
                </Dropdown.Trigger>
                <Dropdown.Content>
                  <Dropdown.Item
                    className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
                    onSelect={() => {
                      setDeleteId(thread.id);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash />
                    <span>Delete</span>
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown>
            </div>
          );
        })}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
            <AlertDialog.Description>
              This action cannot be undone. This will permanently delete your chat and remove it from our servers.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDelete}>Continue</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </ScrollArea>
  );
}
