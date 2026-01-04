import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt';
import { MessageSquare, User, Bot, Clock, Calendar, Activity } from 'lucide-react';
import { useThreadMessages } from '../hooks';
import type { StorageThreadType } from '@mastra/core/memory';

export type ThreadStatsProps = {
  agentId: string;
  thread: StorageThreadType;
  className?: string;
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (start: Date, end: Date): string => {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  }
  return 'Less than a minute';
};

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  className?: string;
};

const StatCard = ({ icon, label, value, subValue, className }: StatCardProps) => (
  <div className={cn('bg-surface3 border border-border1 rounded-lg p-3', className)}>
    <div className="flex items-center gap-2 mb-1">
      <span className="text-icon3">{icon}</span>
      <Txt variant="ui-xs" className="text-icon3">
        {label}
      </Txt>
    </div>
    <div className="text-lg font-medium text-icon5">{value}</div>
    {subValue && (
      <Txt variant="ui-xs" className="text-icon3 mt-0.5">
        {subValue}
      </Txt>
    )}
  </div>
);

export const ThreadStats = ({ agentId, thread, className }: ThreadStatsProps) => {
  // Get first page with 1 item to get total count
  const { data, isLoading } = useThreadMessages({
    threadId: thread.id,
    agentId,
    page: 1,
    perPage: 100, // Get more messages to compute accurate stats
    enabled: Boolean(thread.id && agentId),
  });

  const messages = data?.messages || [];
  const totalMessages = data?.total ?? messages.length;
  
  // Compute stats from messages
  const userMessages = messages.filter(m => m.role === 'user').length;
  const assistantMessages = messages.filter(m => m.role === 'assistant').length;
  const toolMessages = messages.filter(m => 
    m.content.parts?.some(p => p.type === 'tool-invocation')
  ).length;

  // Estimate totals based on sample if we have pagination
  const sampleRatio = totalMessages > 0 ? messages.length / totalMessages : 1;
  const estimatedUserMessages = Math.round(userMessages / sampleRatio);
  const estimatedAssistantMessages = Math.round(assistantMessages / sampleRatio);

  const duration = formatDuration(thread.createdAt, thread.updatedAt);
  
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Txt variant="ui-sm" className="font-medium text-icon5 mb-3">
          Thread Statistics
        </Txt>
        
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<MessageSquare className="w-4 h-4" />}
            label="Total Messages"
            value={totalMessages}
          />
          
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Duration"
            value={duration}
          />
          
          <StatCard
            icon={<User className="w-4 h-4 text-blue-400" />}
            label="User Messages"
            value={estimatedUserMessages}
            subValue={`${Math.round((estimatedUserMessages / totalMessages) * 100) || 0}%`}
          />
          
          <StatCard
            icon={<Bot className="w-4 h-4 text-green-400" />}
            label="Assistant Messages"
            value={estimatedAssistantMessages}
            subValue={toolMessages > 0 ? `${toolMessages} with tools` : undefined}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Txt variant="ui-sm" className="font-medium text-icon5">
          Timeline
        </Txt>
        
        <div className="bg-surface3 border border-border1 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-icon3" />
            <span className="text-icon3">Created:</span>
            <span className="text-icon5">{formatDate(thread.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-icon3" />
            <span className="text-icon3">Last activity:</span>
            <span className="text-icon5">{formatDate(thread.updatedAt)}</span>
          </div>
        </div>
      </div>

      {thread.metadata && Object.keys(thread.metadata).length > 0 && (
        <div className="space-y-2">
          <Txt variant="ui-sm" className="font-medium text-icon5">
            Metadata
          </Txt>
          
          <div className="bg-surface3 border border-border1 rounded-lg p-3">
            <pre className="text-xs text-icon4 overflow-x-auto">
              {JSON.stringify(thread.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
