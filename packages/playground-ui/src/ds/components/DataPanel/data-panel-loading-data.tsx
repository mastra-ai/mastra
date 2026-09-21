import type { ReactNode } from 'react';
import { Spinner } from '@/ds/components/Spinner';

export interface DataPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataPanelLoadingData({ children }: DataPanelLoadingDataProps) {
  return (
    <div className="text-caption text-placeholder flex min-h-32 items-center justify-center gap-2 px-3 py-4">
      <Spinner size="sm" variant="pulse" className="text-placeholder" /> {children ?? 'Loading...'}
    </div>
  );
}
