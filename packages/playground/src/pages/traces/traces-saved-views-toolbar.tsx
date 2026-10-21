import { SavedViewActions, SavedViewTabs, SavedViewUnsavedDialog } from '@mastra/playground-ui/components/SavedViews';
import type { SavedViewsController } from '@mastra/playground-ui/components/SavedViews';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { TraceSavedViewSummary } from '@mastra/playground-ui/domains/traces/components/trace-saved-view-summary';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useTraceSavedViews } from '@mastra/playground-ui/domains/traces/hooks/use-trace-saved-views';
import type { UseTraceSavedViewsOptions } from '@mastra/playground-ui/domains/traces/hooks/use-trace-saved-views';
import { isSavedViewsUnavailableError } from '@mastra/react/hooks/saved-views';
import { useBlocker } from 'react-router';
import { TracesActionRow } from './traces-action-row';

export type TracesSavedViewsHost = UseTraceSavedViewsOptions;

/**
 * The traces toolbar with saved views: view tabs above the action row, with "Reset changes" and
 * "Save to this view" at the right end of the tab row while the active view has changes. Shows only
 * the action row while views load and when the server can't serve them (501, or 404 from an older
 * server). The action row keeps its place either way, so the filter bar isn't remounted when views
 * arrive.
 */
export function TracesSavedViewsToolbar({ host }: { host: TracesSavedViewsHost }) {
  const { views, unreadableFilterCount } = useTraceSavedViews(host);
  const showViews = !views.isLoading && !isSavedViewsUnavailableError(views.loadError);

  return (
    <>
      {showViews && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SavedViewTabs
            aria-label="Trace views"
            className="min-w-0 flex-1"
            views={views}
            defaultLabel="All traces"
            renderSummary={view => <TraceSavedViewSummary view={view} />}
          />
          <SavedViewActions views={views} className="ml-auto" />
        </div>
      )}
      <TracesActionRow
        filterBar={
          <>
            <TracesExplorer.FilterBar />
            {unreadableFilterCount > 0 && (
              <Txt as="span" variant="caption" tone="muted">
                {unreadableFilterCount === 1
                  ? '1 filter needs a newer Studio to show'
                  : `${unreadableFilterCount} filters need a newer Studio to show`}
              </Txt>
            )}
          </>
        }
      />
      <LeaveUnsavedViewDialog views={views} />
    </>
  );
}

/**
 * Asks before leaving the traces page while the active view has unsaved changes, e.g. from the
 * sidebar. Switching views stays on the page, so `SavedViewTabs` asks for that itself.
 */
function LeaveUnsavedViewDialog<TState>({ views }: { views: SavedViewsController<TState> }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => views.unsaved && nextLocation.pathname !== currentLocation.pathname,
  );
  const proceed = () => {
    if (blocker.state === 'blocked') blocker.proceed();
  };
  return (
    <SavedViewUnsavedDialog
      views={views}
      open={blocker.state === 'blocked'}
      onProceed={proceed}
      onCancel={() => {
        if (blocker.state === 'blocked') blocker.reset();
      }}
    />
  );
}
