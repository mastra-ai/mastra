import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  User,
  Bot,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Wrench,
  Check,
} from 'lucide-react';
import { useThreadMessages, type ThreadMessagesFilter, type ThreadMessagesOrderBy } from '../hooks';
import type { MastraDBMessage } from '@mastra/core/agent';

export type ThreadMessageBrowserProps = {
  agentId: string;
  threadId: string;
  className?: string;
};

// Simple relative time formatter
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const formatFullDate = (date: Date): string => {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

type MessageContentDisplayProps = {
  message: MastraDBMessage;
  isExpanded: boolean;
};

const MessageContentDisplay = ({ message, isExpanded }: MessageContentDisplayProps) => {
  const content = message.content;
  
  // Extract text content from parts
  const textParts = content.parts?.filter(p => p.type === 'text') || [];
  const toolParts = content.parts?.filter(p => p.type === 'tool-invocation') || [];
  
  const textContent = textParts.map((p: any) => p.text).join('\n') || content.content || '';
  const displayContent = isExpanded ? textContent : textContent.substring(0, 150);
  const isTruncated = !isExpanded && textContent.length > 150;

  return (
    <div className="space-y-2">
      {displayContent && (
        <div className="text-sm text-icon5 whitespace-pre-wrap break-words">
          {displayContent}
          {isTruncated && <span className="text-icon3">...</span>}
        </div>
      )}
      
      {toolParts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {toolParts.map((tool: any, idx: number) => (
            <Badge 
              key={idx} 
              variant="outline" 
              className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30"
            >
              <Wrench className="w-3 h-3 mr-1" />
              {tool.toolInvocation?.toolName || tool.toolName || 'tool'}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

type MessageItemProps = {
  message: MastraDBMessage;
  onMessageClick?: (messageId: string) => void;
};

const MessageItem = ({ message, onMessageClick }: MessageItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const createdAt = new Date(message.createdAt);
  
  const hasToolCalls = message.content.parts?.some(p => p.type === 'tool-invocation');
  const textContent = message.content.parts?.filter(p => p.type === 'text').map((p: any) => p.text).join('\n') || message.content.content || '';
  const isLongMessage = textContent.length > 150;

  return (
    <div
      className={cn(
        'group border-b border-border1 p-3 hover:bg-surface3/50 transition-colors cursor-pointer',
        message.role === 'user' ? 'bg-surface2/30' : 'bg-surface3/30'
      )}
      onClick={() => {
        if (isLongMessage) {
          setIsExpanded(!isExpanded);
        }
        onMessageClick?.(message.id);
      }}
      data-message-id={message.id}
    >
      <div className="flex items-start gap-3">
        {/* Role icon */}
        <div
          className={cn(
            'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            message.role === 'user' ? 'bg-blue-500/20' : 'bg-green-500/20'
          )}
        >
          {message.role === 'user' ? (
            <User className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-green-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'text-xs font-medium capitalize',
                message.role === 'user' ? 'text-blue-400' : 'text-green-400'
              )}
            >
              {message.role}
            </span>
            <span className="text-xs text-icon3" title={formatFullDate(createdAt)}>
              <Clock className="w-3 h-3 inline mr-1" />
              {formatRelativeTime(createdAt)}
            </span>
            {hasToolCalls && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                Tools
              </Badge>
            )}
          </div>

          <MessageContentDisplay message={message} isExpanded={isExpanded} />
          
          {isLongMessage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show more
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ThreadMessageBrowser = ({ agentId, threadId, className }: ThreadMessageBrowserProps) => {
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'assistant'>('all');
  const [orderDirection, setOrderDirection] = useState<'ASC' | 'DESC'>('DESC');

  // Note: Role filtering is done client-side as the API only supports date filtering
  const filter: ThreadMessagesFilter | undefined = useMemo(() => {
    return undefined; // We'll filter by role client-side
  }, []);

  const orderBy: ThreadMessagesOrderBy = useMemo(
    () => ({ field: 'createdAt', direction: orderDirection }),
    [orderDirection]
  );

  const { data, isLoading, error } = useThreadMessages({
    threadId,
    agentId,
    page,
    perPage,
    orderBy,
    filter,
    enabled: Boolean(threadId && agentId),
  });

  // Client-side filtering (search query + role)
  const filteredMessages = useMemo(() => {
    if (!data?.messages) return [];
    
    let messages = data.messages;
    
    // Apply role filter
    if (roleFilter !== 'all') {
      messages = messages.filter(msg => msg.role === roleFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      messages = messages.filter(msg => {
        const textContent = msg.content.parts
          ?.filter(p => p.type === 'text')
          .map((p: any) => p.text)
          .join(' ') || msg.content.content || '';
        return textContent.toLowerCase().includes(query);
      });
    }
    
    return messages;
  }, [data?.messages, searchQuery, roleFilter]);

  const totalPages = Math.ceil((data?.total || 0) / perPage);

  const handlePrevPage = useCallback(() => {
    setPage(p => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage(p => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setRoleFilter('all');
    setOrderDirection('DESC');
    setPage(1);
  }, []);

  const hasActiveFilters = searchQuery || roleFilter !== 'all' || orderDirection !== 'DESC';

  const handleMessageClick = useCallback((messageId: string) => {
    // Find the message element and highlight it
    const element = document.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
      element.classList.add('ring-2', 'ring-blue-400/50');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-400/50');
      }, 1500);
    }
  }, []);

  if (!threadId) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-icon3 mx-auto mb-3" />
          <Txt variant="ui-sm" className="text-icon3">
            Select a thread to browse messages
          </Txt>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with search and filters */}
      <div className="p-3 border-b border-border1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-icon3" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
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

          {/* Filter dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {roleFilter !== 'all' && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {roleFilter}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2">
              <div className="space-y-1">
                <Txt variant="ui-xs" className="text-icon3 px-2 py-1 font-medium">Filter by role</Txt>
                <button
                  onClick={() => setRoleFilter('all')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface3 text-left"
                >
                  <span className="flex-1">All messages</span>
                  {roleFilter === 'all' && <Check className="w-3.5 h-3.5 text-green-400" />}
                </button>
                <button
                  onClick={() => setRoleFilter('user')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface3 text-left"
                >
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="flex-1">User only</span>
                  {roleFilter === 'user' && <Check className="w-3.5 h-3.5 text-green-400" />}
                </button>
                <button
                  onClick={() => setRoleFilter('assistant')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface3 text-left"
                >
                  <Bot className="w-3.5 h-3.5 text-green-400" />
                  <span className="flex-1">Assistant only</span>
                  {roleFilter === 'assistant' && <Check className="w-3.5 h-3.5 text-green-400" />}
                </button>
                
                <div className="border-t border-border1 my-2" />
                
                <Txt variant="ui-xs" className="text-icon3 px-2 py-1 font-medium">Sort order</Txt>
                <button
                  onClick={() => setOrderDirection('DESC')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface3 text-left"
                >
                  <span className="flex-1">Newest first</span>
                  {orderDirection === 'DESC' && <Check className="w-3.5 h-3.5 text-green-400" />}
                </button>
                <button
                  onClick={() => setOrderDirection('ASC')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface3 text-left"
                >
                  <span className="flex-1">Oldest first</span>
                  {orderDirection === 'ASC' && <Check className="w-3.5 h-3.5 text-green-400" />}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
              Clear
            </Button>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-xs text-icon3">
          <span>
            <MessageSquare className="w-3 h-3 inline mr-1" />
            {data?.total ?? 0} messages
          </span>
          {filteredMessages.length !== (data?.total ?? 0) && (
            <span className="text-blue-400">
              ({filteredMessages.length} shown)
            </span>
          )}
        </div>
      </div>

      {/* Messages list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <Txt variant="ui-sm" className="text-red-400">
              Failed to load messages
            </Txt>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-10 h-10 text-icon3 mx-auto mb-3" />
            <Txt variant="ui-sm" className="text-icon3">
              {searchQuery ? 'No messages match your search' : 'No messages in this thread'}
            </Txt>
          </div>
        ) : (
          <div>
            {filteredMessages.map(message => (
              <MessageItem 
                key={message.id} 
                message={message}
                onMessageClick={handleMessageClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-border1 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={page <= 1}
            className="h-7 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </Button>
          
          <Txt variant="ui-xs" className="text-icon3">
            Page {page} of {totalPages}
          </Txt>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={page >= totalPages}
            className="h-7 text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};
