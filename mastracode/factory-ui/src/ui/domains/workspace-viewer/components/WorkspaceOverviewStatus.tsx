import { Spinner } from '@mastra/playground-ui/components/Spinner';
import type { ReactNode } from 'react';

interface WorkspaceOverviewStatusProps {
  loading: boolean;
  error?: Error;
  children: ReactNode;
}

export function WorkspaceOverviewStatus({ loading, error, children }: WorkspaceOverviewStatusProps) {
  if (loading) return <Spinner size="sm" />;
  if (error) return <span className="text-muted-foreground">Unavailable</span>;

  return children;
}
