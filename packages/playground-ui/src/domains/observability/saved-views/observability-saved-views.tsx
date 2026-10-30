import type { SavedViewPage } from '@mastra/core/storage';
import { createPortal } from 'react-dom';
import { useSavedViewsSource } from './saved-views-source';
import type { SavedViewsContextValue } from './saved-views-source';
import { useHostedSavedViews } from './use-hosted-saved-views';
import type { SavedViewColumnsControl } from './use-hosted-saved-views';
import { useObservabilityHeaderSlot } from '@/domains/observability/components/observability-header-slot';
import { SavedViewPicker } from '@/ds/components/SavedViews/saved-view-picker';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';
import { cn } from '@/lib/utils';

const DEFAULT_LABELS: Record<SavedViewPage, string> = {
  traces: 'All traces',
  spans: 'All spans',
  threads: 'All threads',
  logs: 'All logs',
};

export type ObservabilitySavedViewsProps = {
  page: SavedViewPage;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
  /** The page's column picker (traces, spans, threads), so views save and restore columns. */
  columns?: SavedViewColumnsControl;
  /**
   * The range the page shows when the URL names none, when the host's differs from the page's own
   * (the same value passed to `useObservabilityListFilters`).
   */
  defaultDatePreset?: string;
  className?: string;
};

/**
 * The saved views of an observability page: a searchable view picker with save and reset actions.
 * Inside the shared traces / spans / threads header it moves into that header's row. Renders nothing
 * unless a `SavedViewsProvider` above it supplies where views are stored.
 */
export function ObservabilitySavedViews(props: ObservabilitySavedViewsProps) {
  const context = useSavedViewsSource();
  if (!context) return null;
  return <HostedSavedViewsBar {...props} {...context} />;
}

function HostedSavedViewsBar({
  page,
  searchParams,
  setSearchParams,
  columns,
  defaultDatePreset,
  className,
  source,
  queryKeyScope,
  canEdit,
}: ObservabilitySavedViewsProps & SavedViewsContextValue) {
  const headerSlot = useObservabilityHeaderSlot();
  const views = useHostedSavedViews({
    page,
    source,
    queryKeyScope,
    canEdit,
    searchParams,
    setSearchParams,
    columns,
    defaultDatePreset,
  });

  const picker = (
    <SavedViewPicker
      views={views}
      defaultLabel={DEFAULT_LABELS[page]}
      aria-label="Saved views"
      newViewSettings={{ state: { schemaVersion: 1, page, filters: [] } }}
      describeView={view => (view.settings.record?.scope === 'org' ? 'Shared' : undefined)}
      canEdit={view => !canEdit || !view.settings.record || canEdit(view.settings.record)}
      className={className}
    />
  );
  return headerSlot ? createPortal(picker, headerSlot) : picker;
}
