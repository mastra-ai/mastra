import type { ReactNode } from 'react';
import { LoaderFill } from '@/ds/components/LoaderFill';
import { Spinner } from '@/ds/components/Spinner';

export interface DataDetailsPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataDetailsPanelLoadingData({ children }: DataDetailsPanelLoadingDataProps) {
  return (
    <LoaderFill className="px-4 py-6 text-caption text-muted-foreground">
      <Spinner size="sm" variant="pulse" className="text-muted-foreground" /> {children ?? 'Loading...'}
    </LoaderFill>
  );
}
