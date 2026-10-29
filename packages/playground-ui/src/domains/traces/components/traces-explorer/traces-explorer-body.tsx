import type { ReactNode } from 'react';
import { NoTracesInfo } from '../no-traces-info';
import { TracesErrorContent } from '../traces-error-content';
import { TracesPageSkeleton } from '../traces-page-skeleton';
import {
  useTraceUsageColumns,
  useTracesFilters,
  useTracesList,
  useTracesListFetching,
  useTracesSelection,
} from './traces-explorer-context';
import type { TracesListContextValue } from './traces-explorer-context';
import { useTracesBodyLoading } from './use-traces-discovery';
import { ObservabilityListBody } from '@/domains/observability/components/observability-list-body';

export type TracesExplorerErrorRenderArgs = Pick<TracesListContextValue, 'refetch'> & {
  error: NonNullable<TracesListContextValue['error']>;
  isFetching: boolean;
};

export type TracesExplorerBodyProps = {
  /** Controls at the top of the body, above the list (filters, columns…). The loading skeleton stands in for them. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Renders the list-error state (e.g. host-classified errors with a retry). Defaults to `TracesErrorContent`. */
  renderError?: (args: TracesExplorerErrorRenderArgs) => ReactNode;
};

/** The traces page body without its page frame, for hosts that own the header (e.g. a shared router layout). */
export function TracesExplorerBody({ toolbar, children, renderError }: TracesExplorerBodyProps) {
  const isBodyLoading = useTracesBodyLoading();
  const { rows, isLoading, error, refetch } = useTracesList();
  const { filters, dateFrom, dateTo, contentFiltersApplied } = useTracesFilters();
  const { selectedTraceId } = useTracesSelection();
  const { displayedPreferences } = useTraceUsageColumns();

  // Hold the whole toolbar + list behind one skeleton until field discovery has settled, so the
  // FilterBar never appears without the metadata fields it will offer. Only `isLoading` (never
  // `isFetching`) gates this: background refetches after the stale window must not flash it.
  if (isBodyLoading) {
    return (
      <>
        <h1 className="sr-only">Traces</h1>
        <div>
          <TracesPageSkeleton columnPreferences={displayedPreferences} />
        </div>
      </>
    );
  }

  let errorNode: ReactNode;
  if (error) {
    errorNode = renderError ? (
      <HostTracesError renderError={renderError} error={error} refetch={refetch} />
    ) : (
      <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
    );
  }
  const empty =
    rows.length === 0 && !isLoading && !contentFiltersApplied && !selectedTraceId ? (
      <NoTracesInfo datePreset={filters.datePreset} dateFrom={dateFrom} dateTo={dateTo} />
    ) : undefined;

  return (
    <>
      <h1 className="sr-only">Traces</h1>
      {/* Spaced like the skeleton's toolbar placeholder, so nothing moves when loading ends. */}
      <ObservabilityListBody toolbar={toolbar} error={errorNode} empty={empty}>
        {children}
      </ObservabilityListBody>
    </>
  );
}

/** Reads `isFetching` here so only the error state, not the whole body, re-renders on fetches. */
function HostTracesError({
  renderError,
  ...args
}: Omit<TracesExplorerErrorRenderArgs, 'isFetching'> & {
  renderError: NonNullable<TracesExplorerBodyProps['renderError']>;
}) {
  const isFetching = useTracesListFetching();
  return renderError({ ...args, isFetching });
}
