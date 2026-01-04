import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { useLinkComponent } from '@/lib/framework';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Search, 
  X, 
  MessageSquare, 
  Clock, 
  Trash2,
  ChevronRight,
} from 'lucide-react';
import type { StorageThreadType } from '@mastra/core/memory';

export type EnhancedChatThreadsProps = {
  threads: StorageThreadType[];
  isLoading: boolean;
  threadId: string;
  onDelete: (threadId: string) => void;
  resourceId: string;
  resourceType: 'agent' | 'network';
  className?: string;
};

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function isDefaultThreadName(name: string): boolean {
  const defaultPattern = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  return defaultPattern.test(name);
}

function getThreadDisplayTitle(title?: string, id?: string): string {
  if (!title) return id ? `Thread ${id.substring(id.length - 5)}` : 'Untitled';
  if (isDefaultThreadName(title)) {
    return id ? `Thread ${id.substring(id.length - 5)}` : 'Untitled';
  }
  return title;
}

type ThreadItemProps = {
  thread: StorageThreadType;
  isActive: boolean;
  threadLink: string;
  Link: React.ElementType;
  onDeleteClick: () => void;
};

const ThreadItem = ({ thread, isActive, threadLink, Link, onDeleteClick }: ThreadItemProps) => {
  const displayTitle = getThreadDisplayTitle(thread.title, thread.id);
  const timeAgo = formatRelativeTime(thread.updatedAt || thread.createdAt);
  
  return (
    <div
      className={cn(
        'group relative border-b border-border1 hover:bg-surface3 transition-colors',
        isActive && 'bg-surface4'
      )}
    >
      <Link
        href={threadLink}
        className="block p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-icon3 shrink-0" />
              <Txt
                variant="ui-sm"
                className={cn(
                  'truncate font-medium',
                  isActive ? 'text-icon5' : 'text-icon4'
                )}
              >
                {displayTitle}
              </Txt>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-icon3 ml-5.5">
              <Clock className="w-3 h-3" />
              <span>{timeAgo}</span>
            </div>
          </div>
          
          <ChevronRight className={cn(
            'w-4 h-4 text-icon3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
            isActive && 'opacity-100'
          )} />
        </div>
      </Link>
      
      {/* Delete button overlay */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteClick();
        }}
        className={cn(
          'absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-red-500/20 hover:text-red-400'
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

export const EnhancedChatThreads = ({
  threads,
  isLoading,
  threadId,
  onDelete,
  resourceId,
  resourceType,
  className,
}: EnhancedChatThreadsProps) => {
  const { Link, paths } = useLinkComponent();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const newThreadLink =
    resourceType === 'agent' ? paths.agentNewThreadLink(resourceId) : paths.networkNewThreadLink(resourceId);

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    
    const query = searchQuery.toLowerCase();
    return threads.filter(thread => {
      const title = thread.title?.toLowerCase() || '';
      const id = thread.id.toLowerCase();
      return title.includes(query) || id.includes(query);
    });
  }, [threads, searchQuery]);

  const handleDelete = useCallback(() => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, onDelete]);

  if (isLoading) {
    return (
      <div className={cn('p-4 space-y-3', className)}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-surface2', className)}>
      {/* Header with search */}
      <div className="p-3 border-b border-border1 space-y-3">
        {/* New chat button */}
        <Link
          href={newThreadLink}
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg',
            'bg-accent1/10 hover:bg-accent1/20 transition-colors',
            'text-accent1 font-medium text-sm'
          )}
        >
          <div className="bg-accent1/20 rounded-md p-1.5">
            <Plus className="w-4 h-4" />
          </div>
          New Chat
        </Link>

        {/* Search input */}
        {threads.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-icon3" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search threads..."
              className="pl-8 h-8 text-sm bg-surface3 border-border1"
            />
            {searchQuery && (
              <Button
                onClick={() => setSearchQuery('')}
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Threads list */}
      <ScrollArea className="flex-1">
        {filteredThreads.length === 0 ? (
          <div className="p-4 text-center">
            <MessageSquare className="w-10 h-10 text-icon3 mx-auto mb-3" />
            <Txt variant="ui-sm" className="text-icon3">
              {searchQuery
                ? 'No threads match your search'
                : 'Your conversations will appear here once you start chatting!'}
            </Txt>
          </div>
        ) : (
          <div>
            {filteredThreads.map(thread => {
              const isActive = thread.id === threadId;
              const threadLink =
                resourceType === 'agent'
                  ? paths.agentThreadLink(resourceId, thread.id)
                  : paths.networkThreadLink(resourceId, thread.id);

              return (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={isActive}
                  threadLink={threadLink}
                  Link={Link}
                  onDeleteClick={() => setDeleteId(thread.id)}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Thread count footer */}
      {threads.length > 0 && (
        <div className="p-2 border-t border-border1">
          <Txt variant="ui-xs" className="text-icon3 text-center block">
            {filteredThreads.length === threads.length
              ? `${threads.length} thread${threads.length !== 1 ? 's' : ''}`
              : `${filteredThreads.length} of ${threads.length} threads`}
          </Txt>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Thread?</AlertDialog.Title>
            <AlertDialog.Description>
              This action cannot be undone. This will permanently delete the conversation and all its messages.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDelete}>Delete</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
};
