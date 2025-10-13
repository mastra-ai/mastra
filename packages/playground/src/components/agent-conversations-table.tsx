import { Link } from 'react-router';
import { useMemo, useState } from 'react';
import { MessageSquare, Clock, Copy, Check, User } from 'lucide-react';
import { AgentConversationWithMetadata } from '@/hooks/use-all-agent-conversations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';

interface AgentConversationsTableProps {
  conversations: AgentConversationWithMetadata[];
  isLoading: boolean;
}

function formatTimestamp(timestamp?: Date | string) {
  if (!timestamp) return '-';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function CopyableThreadId({ threadId }: { threadId: string }) {
  const { handleCopy, hasCopied } = useCopyToClipboard({ text: threadId });

  return (
    <div className="flex items-center gap-2 group" onClick={e => e.stopPropagation()}>
      <span className="font-mono text-xs text-text3">{threadId}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          handleCopy();
        }}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {hasCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-text3" />}
      </Button>
    </div>
  );
}

export function AgentConversationsTable({ conversations, isLoading }: AgentConversationsTableProps) {
  const [search, setSearch] = useState('');

  const filteredConversations = useMemo(() => {
    if (!search) return conversations;
    const searchLower = search.toLowerCase();
    return conversations.filter(
      conv =>
        conv.agentName.toLowerCase().includes(searchLower) ||
        conv.id.toLowerCase().includes(searchLower) ||
        (conv.title && conv.title.toLowerCase().includes(searchLower)),
    );
  }, [conversations, search]);

  if (isLoading) {
    return <AgentConversationsTableSkeleton />;
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <MessageSquare className="h-12 w-12 text-icon3 mb-4" />
        <h3 className="text-lg font-medium text-text2 mb-2">No conversations found</h3>
        <p className="text-sm text-text3 max-w-md">
          Agent conversations will appear here once you chat with an agent that has memory enabled. Try starting a
          conversation with an agent to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by agent name, thread ID, or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md bg-surface2 border-border1"
        />
        <span className="text-sm text-text3">
          {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
        </span>
      </div>

      <div className="rounded-md border border-border1 bg-surface2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border1">
              <TableHead className="text-text3 font-medium">Agent</TableHead>
              <TableHead className="text-text3 font-medium">Title</TableHead>
              <TableHead className="text-text3 font-medium">Thread ID</TableHead>
              <TableHead className="text-text3 font-medium">Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-text3 py-8">
                  No conversations match your search
                </TableCell>
              </TableRow>
            ) : (
              filteredConversations.map(conv => (
                <TableRow
                  key={conv.id}
                  className="border-border1 hover:bg-surface3 transition-colors cursor-pointer"
                  onClick={() => {
                    window.location.href = `/agents/${conv.agentId}/chat/${conv.id}`;
                  }}
                >
                  <TableCell>
                    <Link
                      to={`/agents/${conv.agentId}/chat/${conv.id}`}
                      className="flex items-center gap-2 font-medium text-text1 hover:text-accent1 transition-colors"
                    >
                      <User className="h-4 w-4 text-icon3" />
                      {conv.agentName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-text2">{conv.title || 'Untitled conversation'}</span>
                  </TableCell>
                  <TableCell>
                    <CopyableThreadId threadId={conv.id} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-text3 text-sm">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(conv.updatedAt)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AgentConversationsTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="rounded-md border border-border1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border1">
              <TableHead>Agent</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Thread ID</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-border1">
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
