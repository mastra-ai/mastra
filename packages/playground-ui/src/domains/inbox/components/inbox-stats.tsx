import type { InboxStats } from '@mastra/core';
import { Clock, Play, CheckCircle, XCircle, Pause, RefreshCw, Inbox } from 'lucide-react';

export interface InboxStatsDisplayProps {
  stats: InboxStats;
  isLoading?: boolean;
  variant?: 'compact' | 'cards';
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'neutral' | 'blue' | 'green' | 'red' | 'yellow';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    neutral: 'bg-surface3 text-neutral1',
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
  };

  const iconColorClasses = {
    neutral: 'text-neutral3',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${colorClasses[color]}`}>
      <div className={`${iconColorClasses[color]}`}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-lg font-semibold leading-tight">{value}</span>
        <span className="text-xs text-neutral3">{label}</span>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface3 px-4 py-3">
      <div className="h-5 w-5 animate-pulse rounded bg-surface4" />
      <div className="flex flex-col gap-1">
        <div className="h-5 w-8 animate-pulse rounded bg-surface4" />
        <div className="h-3 w-14 animate-pulse rounded bg-surface4" />
      </div>
    </div>
  );
}

export function InboxStatsDisplay({ stats, isLoading, variant = 'cards' }: InboxStatsDisplayProps) {
  const totalTasks =
    stats.pending + stats.claimed + stats.inProgress + stats.waitingForInput + stats.completed + stats.failed;
  const activeTasks = stats.pending + stats.claimed + stats.inProgress + stats.waitingForInput;

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-neutral3">
          <Inbox className="h-4 w-4" />
          <span className="font-medium text-neutral1">{totalTasks}</span> total
        </div>
        <div className="h-4 w-px bg-border1" />
        <div className="flex items-center gap-1.5 text-neutral3">
          <Clock className="h-4 w-4 text-neutral3" />
          <span className="font-medium text-neutral1">{stats.pending}</span> pending
        </div>
        <div className="flex items-center gap-1.5 text-neutral3">
          <Play className="h-4 w-4 text-blue-400" />
          <span className="font-medium text-neutral1">{stats.inProgress}</span> running
        </div>
        <div className="flex items-center gap-1.5 text-neutral3">
          <Pause className="h-4 w-4 text-yellow-400" />
          <span className="font-medium text-neutral1">{stats.waitingForInput}</span> waiting
        </div>
        <div className="flex items-center gap-1.5 text-neutral3">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="font-medium text-neutral1">{stats.completed}</span> done
        </div>
        <div className="flex items-center gap-1.5 text-neutral3">
          <XCircle className="h-4 w-4 text-red-400" />
          <span className="font-medium text-neutral1">{stats.failed}</span> failed
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <StatCard icon={<Inbox className="h-5 w-5" />} label="Total" value={totalTasks} color="neutral" />
      <StatCard icon={<Clock className="h-5 w-5" />} label="Pending" value={stats.pending} color="neutral" />
      <StatCard icon={<RefreshCw className="h-5 w-5" />} label="Claimed" value={stats.claimed} color="blue" />
      <StatCard icon={<Play className="h-5 w-5" />} label="In Progress" value={stats.inProgress} color="blue" />
      <StatCard icon={<Pause className="h-5 w-5" />} label="Waiting" value={stats.waitingForInput} color="yellow" />
      <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Completed" value={stats.completed} color="green" />
      <StatCard icon={<XCircle className="h-5 w-5" />} label="Failed" value={stats.failed} color="red" />
    </div>
  );
}
