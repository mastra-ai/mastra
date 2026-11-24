import type { ReactNode } from 'react';
import { BrandLoader } from '@/ds/components/BrandLoader';
import { LoaderFill } from '@/ds/components/LoaderFill';

export interface DataPanelLoadingDataProps {
  children?: ReactNode;
}

export function DataPanelLoadingData({ children }: DataPanelLoadingDataProps) {
  return (
    <LoaderFill className="px-3 py-4 text-caption text-subtle-foreground">
      <BrandLoader size="sm" /> {children ?? 'Loading...'}
    </LoaderFill>
  );
}
