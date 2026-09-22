import type { ReactNode } from 'react';
import { Spinner } from '@/ds/components/Spinner';

export interface DataDetailsPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataDetailsPanelLoadingData({ children }: DataDetailsPanelLoadingDataProps) {
  return (
    <div className="text-caption text-muted-foreground flex items-center justify-center gap-2 px-4 py-6">
      <Spinner size="sm" variant="pulse" className="text-muted-foreground" /> {children ?? 'Loading...'}
    </div>
  );
}
