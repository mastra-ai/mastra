import type { SavedViewResponse } from '@mastra/client-js';
import type { EntityType } from '@mastra/core/observability';
import { getColumnOrderStorageKey, keyedColumnOrderSchema } from '@mastra/playground-ui/components/DataList';
import {
  MAX_SAVED_VIEW_NAME_CHARS,
  savedViewNameSchema,
  storedSavedViewSchema,
} from '@mastra/playground-ui/components/SavedViews';
import type {
  SavedViewContent,
  SavedViewDraft,
  SavedViewsController,
} from '@mastra/playground-ui/components/SavedViews';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesColumnsState,
  TracesExplorerState,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import {
  readTraceColumnPreferences,
  writeTraceColumnPreferences,
} from '@mastra/playground-ui/domains/traces/hooks/use-trace-column-preferences';
import { TRACE_PROPERTY_FILTER_PARAM_BY_FIELD } from '@mastra/playground-ui/domains/traces/trace-filters';
import { ALL_TRACES_LIST_ID } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import {
  fromTraceViewContent,
  toTraceViewContent,
  TRACE_SAVED_VIEWS_PAGE,
  traceViewSettingsSchema,
} from '@mastra/playground-ui/domains/traces/trace-saved-views';
import type { TraceViewSettings, TracesViewState } from '@mastra/playground-ui/domains/traces/trace-saved-views';
import { useLocalStorageState } from '@mastra/playground-ui/hooks/use-local-storage-state';
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useUpdateSavedView,
} from '@mastra/react/hooks/saved-views';
import { useTraceColumnPreferencesStorageKey } from '@mastra/react/hooks/traces';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { STUDIO_TRACES_FEATURES } from './features';
import { useTraceFilterPersistence } from './hooks/use-trace-filter-persistence';
import { useTracesRouteState } from './hooks/use-traces-route-state';
import { useTracesScopeParams } from './hooks/use-traces-scope-params';
import { TracesPageContent } from './traces-page-content';
import { TracesSavedViewsContext } from './traces-saved-views-context';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

type TracesPageProps = {
  scopedEntityId?: string;
  scopedEntityType?: EntityType;
};

// The agent Chat tab opens its Traces tab filtered to the open conversation. That filter is
// navigation context, so it must not be restored on a later visit.
const SCOPED_UNSAVED_FILTER_PARAMS = [TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.threadId];

const NEW_VIEW_NAME = 'Untitled view';

const toState = ({ filters, settings }: SavedViewContent<TraceViewSettings>) => ({ version: 1, filters, settings });

export default function TracesPage({ scopedEntityId, scopedEntityType }: TracesPageProps = {}) {
  const isScoped = !!scopedEntityId;
  const [searchParams, setSearchParams] = useSearchParams();

  useTracesScopeParams(searchParams, setSearchParams, scopedEntityId, scopedEntityType);
  const setPersistedSearchParams = useTraceFilterPersistence(searchParams, setSearchParams, {
    storageKey: isScoped ? `mastra:traces:saved-filters:${scopedEntityType}:${scopedEntityId}` : undefined,
    excludeParams: isScoped ? SCOPED_UNSAVED_FILTER_PARAMS : undefined,
  });
  const route = useTracesRouteState(searchParams, setSearchParams, setPersistedSearchParams);

  const { supportsMetrics, isLoading: isMetricsLoading } = useObservabilityStorageCapabilities();
  const metricsSupport = useMemo(
    () => ({ supported: supportsMetrics, isLoading: isMetricsLoading }),
    [supportsMetrics, isMetricsLoading],
  );
  const scope = useMemo(
    () => (scopedEntityId ? { entityId: scopedEntityId, entityType: scopedEntityType } : undefined),
    [scopedEntityId, scopedEntityType],
  );

  // The columns chosen without a view, in the explorer's own storage. Only the unscoped page hands
  // its columns to the explorer, so a view can carry its own; scoped pages keep the explorer's.
  const columnPreferencesKey = useTraceColumnPreferencesStorageKey();
  const [preferences, setPreferences] = useState(() => readTraceColumnPreferences(columnPreferencesKey));
  const [order, setOrder] = useLocalStorageState({
    initialKey: getColumnOrderStorageKey(ALL_TRACES_LIST_ID),
    schema: keyedColumnOrderSchema,
    defaultValue: [],
  });
  const ownColumns = useMemo(() => ({ preferences, order }), [preferences, order]);

  // Saved views, on the unscoped page only.
  const list = useSavedViews({ page: TRACE_SAVED_VIEWS_PAGE, queryOptions: { enabled: !isScoped } });
  const create = useCreateSavedView();
  const update = useUpdateSavedView();
  const remove = useDeleteSavedView();
  const queryClient = useQueryClient();
  const [pendingDraft, setDraft] = useState<SavedViewDraft<TraceViewSettings>>();
  const savedViews = useMemo(
    () =>
      (list.data ?? []).flatMap(view => {
        const stored = storedSavedViewSchema.safeParse({
          id: view.id,
          name: view.name,
          filters: view.state.filters,
          settings: view.state.settings,
        });
        const settings = stored.success ? traceViewSettingsSchema.safeParse(stored.data.settings) : undefined;
        return stored.success && settings?.success ? [{ ...stored.data, settings: settings.data }] : [];
      }),
    [list.data],
  );
  const activeView = savedViews.find(view => view.id === route.activeViewId);
  // An edit belongs to its view: once another view is active (e.g. the URL changed), it isn't shown.
  const draft =
    pendingDraft?.viewId === undefined || pendingDraft.viewId === route.activeViewId ? pendingDraft : undefined;

  // The list follows a save right away, so the saved view shows without waiting for the refetch.
  const showSaved = (saved: SavedViewResponse) =>
    queryClient.setQueryData<SavedViewResponse[]>(['saved-views', TRACE_SAVED_VIEWS_PAGE], current =>
      current?.some(view => view.id === saved.id)
        ? current.map(view => (view.id === saved.id ? saved : view))
        : [...(current ?? []), saved],
    );
  // A new action starts without the last one's error, like the kit's browser-storage views.
  const clearErrors = () => {
    create.reset();
    update.reset();
    remove.reset();
  };

  // What SavedViewTabs and SavedViewEditor take, with the semantics of the kit's `useSavedViews`.
  const views: SavedViewsController<TraceViewSettings> = {
    views: savedViews,
    activeView,
    draft,
    unsaved:
      draft !== undefined &&
      (draft.viewId === undefined ||
        JSON.stringify([draft.name, draft.filters, draft.settings]) !==
          JSON.stringify([activeView?.name, activeView?.filters, activeView?.settings])),
    applied: draft ?? activeView,
    pending: create.isPending || update.isPending || remove.isPending,
    isLoading: list.isPending,
    loadError: list.error ?? undefined,
    storageError: create.error || update.error || remove.error ? 'Could not save changes. Try again.' : undefined,
    select: viewId => {
      clearErrors();
      setDraft(undefined);
      route.setActiveViewId(viewId);
    },
    create: (settings, filters = []) => setDraft({ name: NEW_VIEW_NAME, filters, settings }),
    edit: viewId => {
      if (draft?.viewId === viewId) return;
      const view = savedViews.find(candidate => candidate.id === viewId);
      if (!view) return;
      const { id, ...content } = view;
      setDraft({ ...content, viewId: id });
      if (viewId !== route.activeViewId) route.setActiveViewId(viewId);
    },
    change: patch => {
      if (draft) {
        setDraft({ ...draft, ...patch });
        return;
      }
      if (!activeView) return;
      const { id, ...content } = activeView;
      setDraft({ ...content, ...patch, viewId: id });
    },
    save: async () => {
      if (!draft) return;
      clearErrors();
      const { viewId, ...content } = draft;
      const name = savedViewNameSchema.safeParse(content.name).data ?? activeView?.name ?? NEW_VIEW_NAME;
      try {
        const saved = viewId
          ? await update.mutateAsync({ savedViewId: viewId, name, state: toState(content) })
          : await create.mutateAsync({ page: TRACE_SAVED_VIEWS_PAGE, name, state: toState(content) });
        showSaved(saved);
        setDraft(undefined);
        if (saved.id !== route.activeViewId) route.setActiveViewId(saved.id);
      } catch {
        // Shown through `storageError`; the draft stays so nothing is lost.
      }
    },
    discard: () => {
      clearErrors();
      setDraft(undefined);
    },
    rename: (viewId, name) => {
      const nextName = savedViewNameSchema.safeParse(name).data;
      if (!nextName) return;
      clearErrors();
      update.mutate(
        { savedViewId: viewId, name: nextName },
        {
          onSuccess: () => setDraft(current => (current?.viewId === viewId ? { ...current, name: nextName } : current)),
        },
      );
    },
    duplicate: async viewId => {
      const view = savedViews.find(candidate => candidate.id === viewId);
      if (!view) return;
      clearErrors();
      try {
        const copy = await create.mutateAsync({
          page: TRACE_SAVED_VIEWS_PAGE,
          name: `${view.name} copy`.slice(0, MAX_SAVED_VIEW_NAME_CHARS),
          state: toState(view),
        });
        showSaved(copy);
        setDraft(undefined);
        route.setActiveViewId(copy.id);
      } catch {
        // Shown through `storageError`.
      }
    },
    remove: async viewId => {
      clearErrors();
      try {
        await remove.mutateAsync(viewId);
      } catch {
        // Shown through `storageError`.
        return;
      }
      setDraft(current => (current?.viewId === viewId ? undefined : current));
      if (route.activeViewId === viewId) route.setActiveViewId(undefined);
    },
  };

  // What the explorer shows: the applied view, else the URL. Edits go to the view's draft while one
  // is applied, so "All traces" brings back the URL's filters untouched.
  const view = useMemo(() => views.applied && fromTraceViewContent(views.applied), [views.applied]);
  const filters = view?.filters ?? route.filters;
  const sortDirection = view?.sortDirection ?? route.sortDirection;
  const columns = view?.columns ?? ownColumns;
  const patch = (next: Partial<TracesViewState>) =>
    views.change(toTraceViewContent({ filters, sortDirection, columns, ...next }));
  const onChange = (next: TracesExplorerState) => {
    if (!views.applied) {
      route.setState(next);
      return;
    }
    if (next.filters !== filters) patch({ filters: next.filters });
    if (next.selection !== route.selection) route.setState({ selection: next.selection, filters: route.filters });
  };
  const onColumnsChange = (next: TracesColumnsState) => {
    if (views.applied) {
      patch({ columns: next });
      return;
    }
    setPreferences(next.preferences);
    writeTraceColumnPreferences(columnPreferencesKey, next.preferences);
    setOrder(next.order);
  };
  // "New view" starts from the time range, sort and columns shown, without filters.
  const newViewSettings = toTraceViewContent({ filters: { ...filters, groups: [] }, sortDirection, columns }).settings;

  return (
    <TracesSavedViewsContext.Provider value={isScoped ? null : { views, newViewSettings }}>
      <TracesExplorer
        metricsSupport={metricsSupport}
        selection={route.selection}
        filters={filters}
        onChange={onChange}
        sortDirection={sortDirection}
        onSortDirectionChange={direction =>
          views.applied ? patch({ sortDirection: direction }) : route.setSortDirection(direction)
        }
        scope={scope}
        features={STUDIO_TRACES_FEATURES}
        {...(!isScoped && { columns, onColumnsChange })}
      >
        <TracesPageContent isScoped={isScoped} />
      </TracesExplorer>
    </TracesSavedViewsContext.Provider>
  );
}
