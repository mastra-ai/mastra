import type { ReactNode } from 'react';
import { Spinner } from '@/ds/components/Spinner';

export interface DataPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataPanelLoadingData({ children }: DataPanelLoadingDataProps) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-6 text-ui-sm text-neutral2">
      <Spinner size="sm" variant="pulse" className="text-neutral1" /> {children ?? 'Loading...'}
    </div>
  );
}
