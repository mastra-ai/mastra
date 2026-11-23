import type { ReactNode } from 'react';
import { BrandLoader } from '@/ds/components/BrandLoader';
import { LoaderFill } from '@/ds/components/LoaderFill';

export interface DataDetailsPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataDetailsPanelLoadingData({ children }: DataDetailsPanelLoadingDataProps) {
  return (
    <LoaderFill className="px-4 py-6 text-caption text-muted-foreground">
      <BrandLoader size="sm" /> {children ?? 'Loading...'}
    </LoaderFill>
  );
}
