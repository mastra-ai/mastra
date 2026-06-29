import type { ReactNode } from 'react';
import { Spinner } from '@/ds/components/Spinner';

export interface DataDetailsPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataDetailsPanelLoadingData({ children }: DataDetailsPanelLoadingDataProps) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-6 text-ui-sm text-neutral3">
      <Spinner size="sm" variant="pulse" className="text-neutral3" /> {children ?? 'Loading...'}
    </div>
  );
}
