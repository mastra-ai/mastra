import type { ReactNode } from 'react';
import { NoTracesInfo } from '../no-traces-info';
import { TracesErrorContent } from '../traces-error-content';
import { TracesPageSkeleton } from '../traces-page-skeleton';
import {
  useTraceUsageColumns,
  useTracesConfig,
  useTracesFilters,
  useTracesList,
  useTracesListFetching,
  useTracesSelection,
} from './traces-explorer-context';
import type { TracesListContextValue } from './traces-explorer-context';
import { useTracesDiscovery } from './use-traces-discovery';
import { PageLayout } from '@/ds/components/PageLayout';

export type TracesExplorerErrorRenderArgs = Pick<TracesListContextValue, 'refetch'> & {
  error: NonNullable<TracesListContextValue['error']>;
  isFetching: boolean;
};

export type TracesExplorerLayoutProps = {
  breadcrumbs?: ReactNode;
  /** Navigation pinned under the header (e.g. view tabs). Unlike `actionRow`, it stays up while filter fields load. */
  tabs?: ReactNode;
  /** Controls pinned under the header, hidden while filter fields load. */
  actionRow?: ReactNode;
  /** Controls at the top of the page body, above the list (filters, columns…). The loading skeleton stands in for them. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Renders the list-error state (e.g. host-classified errors with a retry). Defaults to `TracesErrorContent`. */
  renderError?: (args: TracesExplorerErrorRenderArgs) => ReactNode;
};

export function TracesExplorerLayout({
  breadcrumbs,
  tabs,
  actionRow,
  toolbar,
  children,
  renderError,
}: TracesExplorerLayoutProps) {
  const { isCapabilitiesLoading } = useTracesConfig();
  const { isLoading: isDiscoveryLoading } = useTracesDiscovery();
  const { rows, isLoading, error, refetch } = useTracesList();
  const { filters, dateFrom, dateTo, contentFiltersApplied } = useTracesFilters();
  const { selectedTraceId } = useTracesSelection();
  const { displayedPreferences } = useTraceUsageColumns();

  // Hold the whole toolbar + list behind one skeleton until field discovery has settled, so the
  // FilterBar never appears without the metadata fields it will offer. Only `isLoading` (never
  // `isFetching`) gates this: background refetches after the stale window must not flash it.
  if (isCapabilitiesLoading || isDiscoveryLoading) {
    return (
      <PageLayout breadcrumbs={breadcrumbs} actionRow={tabs}>
        <h1 className="sr-only">Traces</h1>
        <div>
          <TracesPageSkeleton columnPreferences={displayedPreferences} />
        </div>
      </PageLayout>
    );
  }

  const pinned =
    tabs || actionRow ? (
      <>
        {tabs}
        {actionRow}
      </>
    ) : undefined;

  let body: ReactNode = children;
  if (error) {
    body = (
      <div className="flex h-full items-center justify-center">
        {renderError ? (
          <HostTracesError renderError={renderError} error={error} refetch={refetch} />
        ) : (
          <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
        )}
      </div>
    );
  } else if (rows.length === 0 && !isLoading && !contentFiltersApplied && !selectedTraceId) {
    body = <NoTracesInfo datePreset={filters.datePreset} dateFrom={dateFrom} dateTo={dateTo} />;
  }

  return (
    <PageLayout breadcrumbs={breadcrumbs} actionRow={pinned}>
      <h1 className="sr-only">Traces</h1>
      {toolbar ? (
        // Spaced like the skeleton's toolbar placeholder, so nothing moves when loading ends.
        <div className="flex h-full min-h-0 flex-col gap-4">
          {toolbar}
          <div className="min-h-0 flex-1">{body}</div>
        </div>
      ) : (
        body
      )}
    </PageLayout>
  );
}

/** Reads `isFetching` here so only the error state, not the whole layout, re-renders on fetches. */
function HostTracesError({
  renderError,
  ...args
}: Omit<TracesExplorerErrorRenderArgs, 'isFetching'> & {
  renderError: NonNullable<TracesExplorerLayoutProps['renderError']>;
}) {
  const isFetching = useTracesListFetching();
  return renderError({ ...args, isFetching });
}
