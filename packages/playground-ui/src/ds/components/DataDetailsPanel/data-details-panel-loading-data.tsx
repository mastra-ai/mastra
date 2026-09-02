import type { ReactNode } from 'react';
import { Spinner } from '@/ds/components/Spinner';

export interface DataDetailsPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataDetailsPanelLoadingData({ children }: DataDetailsPanelLoadingDataProps) {
  return (
    <div className="text-ui-sm flex items-center justify-center gap-2 px-4 py-6 text-(--text-secondary)">
      <Spinner size="sm" variant="pulse" className="text-(--text-secondary)" /> {children ?? 'Loading...'}
    </div>
  );
}
