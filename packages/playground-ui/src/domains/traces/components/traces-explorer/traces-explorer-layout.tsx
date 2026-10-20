import type { ReactNode } from 'react';
import { NoTracesInfo } from '../no-traces-info';
import { TracesErrorContent } from '../traces-error-content';
import { TracesPageSkeleton } from '../traces-page-skeleton';
import {
  useTraceUsageColumns,
  useTracesConfig,
  useTracesFilters,
  useTracesList,
  useTracesSelection,
} from './traces-explorer-context';
import { PageLayout } from '@/ds/components/PageLayout';

export type TracesExplorerLayoutProps = {
  breadcrumbs?: ReactNode;
  actionRow: ReactNode;
  children: ReactNode;
};

export function TracesExplorerLayout({ breadcrumbs, actionRow, children }: TracesExplorerLayoutProps) {
  const { isCapabilitiesLoading, isDiscoveryLoading } = useTracesConfig();
  const { rows, isLoading, error } = useTracesList();
  const { filters, dateFrom, dateTo, contentFiltersApplied } = useTracesFilters();
  const { selectedTraceId } = useTracesSelection();
  const { displayedPreferences } = useTraceUsageColumns();

  // Hold the whole toolbar + list behind one skeleton until field discovery has settled, so the
  // FilterBar never appears without the metadata fields it will offer. Only `isLoading` (never
  // `isFetching`) gates this: background refetches after the stale window must not flash it.
  if (isCapabilitiesLoading || isDiscoveryLoading) {
    return (
      <PageLayout breadcrumbs={breadcrumbs}>
        <h1 className="sr-only">Traces</h1>
        <div>
          <TracesPageSkeleton columnPreferences={displayedPreferences} />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={breadcrumbs} actionRow={actionRow}>
        <h1 className="sr-only">Traces</h1>
        <div className="flex h-full items-center justify-center">
          <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
        </div>
      </PageLayout>
    );
  }

  if (rows.length === 0 && !isLoading && !contentFiltersApplied && !selectedTraceId) {
    return (
      <PageLayout breadcrumbs={breadcrumbs} actionRow={actionRow}>
        <h1 className="sr-only">Traces</h1>
        <NoTracesInfo datePreset={filters.datePreset} dateFrom={dateFrom} dateTo={dateTo} />
      </PageLayout>
    );
  }

  return (
    <PageLayout breadcrumbs={breadcrumbs} actionRow={actionRow}>
      <h1 className="sr-only">Traces</h1>
      {children}
    </PageLayout>
  );
}
