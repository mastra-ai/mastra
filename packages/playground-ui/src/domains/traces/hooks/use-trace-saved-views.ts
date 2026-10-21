import { DEFAULT_TRACES_FILTERS } from '../components/traces-explorer/traces-explorer-actions';
import type { TracesFilters, TracesSortDirection } from '../components/traces-explorer/traces-explorer-actions';
import {
  appliedTraceSavedViewState,
  toTraceSavedViewState,
  traceFiltersFromSavedView,
  traceSavedViewStateSchema,
  tracesPageStateFromView,
} from '../trace-saved-views';
import type { TraceSavedViewState, TracesPageState } from '../trace-saved-views';
import type { TracesColumnsState } from './use-trace-columns-state';
import { sameSavedViewState, useSavedViews } from '@/ds/components/SavedViews';
import type { SavedViewsBackend, SavedViewsController } from '@/ds/components/SavedViews';

/** What applying a view puts on the page, with the view's id. */
export type TraceSavedViewSelection = TracesPageState & { viewId: string };

export type UseTraceSavedViewsOptions = {
  backend: SavedViewsBackend;
  /** The active view, e.g. from a `?view=` search param. */
  activeViewId: string | undefined;
  /**
   * What the explorer shows: the host's filters as given (including those the server can't run,
   * which the explorer shows muted), sort and columns (see `useTraceColumnsState`).
   */
  filters: TracesFilters;
  sortDirection: TracesSortDirection;
  columns: TracesColumnsState;
  /**
   * Shows a view: write its filters, sort, columns and id in one update, so none of them races
   * the others. `undefined` is the default tab ("All traces"), where the host restores its own state.
   */
  onApply: (view: TraceSavedViewSelection | undefined) => void;
  /** Changes the active view without touching the page (after it was saved as a view, or the view was deleted). */
  onActiveViewChange: (viewId: string | undefined) => void;
};

// A view whose time range this Studio doesn't know opens on the explorer's default.
const DEFAULT_DATE_PRESET = DEFAULT_TRACES_FILTERS.datePreset;

export type TraceSavedViewsResult = {
  views: SavedViewsController<TraceSavedViewState>;
  /** How many of the active view's filters use an operator this Studio doesn't know, so they aren't shown. */
  unreadableFilterCount: number;
};

/**
 * Saved views for the traces explorer, for any host and any `SavedViewsBackend`. The host keeps
 * the page state (URL, columns) and this hook turns it into a view's `state`, and back. Filters
 * the server can't run stay in the view: the explorer shows them muted and saving keeps them.
 */
export function useTraceSavedViews({
  backend,
  activeViewId,
  filters,
  sortDirection,
  columns,
  onApply,
  onActiveViewChange,
}: UseTraceSavedViewsOptions): TraceSavedViewsResult {
  const views = useSavedViews({
    backend,
    schema: traceSavedViewStateSchema,
    activeViewId,
    current: toTraceSavedViewState({ filters, sortDirection, columns }),
    onApply: view => onApply(view && { viewId: view.id, ...tracesPageStateFromView(view.state, DEFAULT_DATE_PRESET) }),
    onActiveViewChange,
    isSameState: (current, saved) =>
      sameSavedViewState(current, appliedTraceSavedViewState(saved, DEFAULT_DATE_PRESET)),
  });

  const unreadableFilterCount = views.activeView
    ? traceFiltersFromSavedView(views.activeView.state, DEFAULT_DATE_PRESET).unreadableCount
    : 0;

  return { views, unreadableFilterCount };
}
