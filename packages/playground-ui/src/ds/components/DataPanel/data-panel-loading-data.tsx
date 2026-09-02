import type { ReactNode } from 'react';
import { Spinner } from '@/ds/components/Spinner';

export interface DataPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataPanelLoadingData({ children }: DataPanelLoadingDataProps) {
  return (
    <div className="text-ui-sm text-gray-9 flex min-h-32 items-center justify-center gap-2 px-4 py-6">
      <Spinner size="sm" variant="pulse" className="text-gray-6" /> {children ?? 'Loading...'}
    </div>
  );
}
