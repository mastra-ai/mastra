import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../ui/SkeletonRows';

interface WorkspaceOverviewStatusProps {
  loading: boolean;
  error?: Error;
  children: ReactNode;
}

export function WorkspaceOverviewStatus({ loading, error, children }: WorkspaceOverviewStatusProps) {
  if (loading) return <SkeletonRows label="Loading changes" rows={1} rowClassName="h-3 w-16" />;
  if (error) return <span className="text-muted-foreground">Unavailable</span>;

  return children;
}
