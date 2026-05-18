import { Skeleton } from '@mastra/playground-ui';
import type { ReactNode } from 'react';

export interface AgentProfileProps {
  children: ReactNode;
  isLoading?: boolean;
}

export const AgentProfile = ({ children, isLoading = false }: AgentProfileProps) => {
  if (isLoading) {
    return <AgentProfileSkeleton />;
  }

  return (
    <div
      className="grid grid-rows-[auto_1fr] gap-4 border border-border1 bg-surface2 rounded-3xl p-6 h-full min-h-0"
      data-testid="agent-profile"
    >
      {children}
    </div>
  );
};

const AgentProfileSkeleton = () => (
  <div
    className="flex h-full flex-col gap-4 border border-border1 bg-surface2 rounded-3xl overflow-hidden p-6"
    data-testid="agent-profile-skeleton"
  >
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border1 bg-surface3 p-4">
      <Skeleton className="h-avatar-lg w-avatar-lg rounded-full shrink-0" />
      <div className="w-full space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
    <div className="flex flex-col">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex items-center gap-3 px-6 py-4">
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  </div>
);
