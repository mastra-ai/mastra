import { hashKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { parseSavedView, sameSavedViewState, savedViewNameSchema } from './saved-view-schema';
import type { SavedView, SavedViewSchema } from './saved-view-schema';
import type { SavedViewRecord, SavedViewRecordInput, SavedViewsBackend } from './saved-views-backend';

export const NEW_SAVED_VIEW_NAME = 'Untitled view';

export type UseSavedViewsOptions<TState> = {
  backend: SavedViewsBackend;
  /** Checks a stored view's `state` when it is read. A view that no longer parses is skipped. */
  schema: SavedViewSchema<TState>;
  activeViewId: string | undefined;
  /**
   * What the page shows right now. "Create new view…" and "Save to this view" save it, and it is
   * compared with the active view to find unsaved changes. Pass `undefined` while the page shows
   * the active view exactly as saved (e.g. when edits live in a draft the page keeps itself).
   */
  current: TState | undefined;
  /** Shows a view on the page and makes it the active one. `undefined` is the default tab. */
  onApply: (view: SavedView<TState> | undefined) => void;
  /** Changes the active view without changing the page: after the page was saved as a view, or the view was deleted. */
  onActiveViewChange: (viewId: string | undefined) => void;
  /** Whether the page still matches a view. Defaults to comparing their JSON, whatever the key order. */
  isSameState?: (current: TState, saved: TState) => boolean;
};

export type SavedViewsController<TState> = {
  views: SavedView<TState>[];
  activeView: SavedView<TState> | undefined;
  /** True until the first list arrives. */
  isLoading: boolean;
  /** What the backend threw while listing views. */
  loadError: unknown;
  /** Why the last save, rename, duplicate or delete failed. */
  error: string | undefined;
  /** The page no longer matches the active view. */
  unsaved: boolean;
  /** A save, rename, duplicate or delete is in flight. */
  pending: boolean;
  /** The name of a new view is being typed. */
  creating: boolean;
  select: (viewId: string | undefined) => void;
  startCreating: () => void;
  cancelCreating: () => void;
  /** Saves what the page shows as a new view and makes it active. */
  create: (name: string) => void;
  /** Saves what the page shows to the active view. `onSaved` runs once it is stored. */
  save: (options?: { onSaved?: () => void }) => void;
  /** Shows the active view as saved again. */
  reset: () => void;
  rename: (viewId: string, name: string) => void;
  duplicate: (viewId: string) => void;
  remove: (viewId: string) => void;
};

function validViewName(name: string): string | undefined {
  const parsed = savedViewNameSchema.safeParse(name);
  return parsed.success ? parsed.data : undefined;
}

export function useSavedViews<TState>({
  backend,
  schema,
  activeViewId,
  current,
  onApply,
  onActiveViewChange,
  isSameState = sameSavedViewState,
}: UseSavedViewsOptions<TState>): SavedViewsController<TState> {
  const queryClient = useQueryClient();
  const { queryKey, subscribe } = backend;
  const list = useQuery({ queryKey, queryFn: backend.list, retry: false });
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);

  const queryHash = hashKey(queryKey);
  useEffect(() => {
    if (!subscribe) return;
    return subscribe(() => void queryClient.invalidateQueries({ queryKey }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the query hash, not the key array's identity
  }, [queryClient, subscribe, queryHash]);

  const updateCachedViews = (update: (records: SavedViewRecord[]) => SavedViewRecord[]) => {
    queryClient.setQueryData<SavedViewRecord[]>(queryKey, records => (records ? update(records) : records));
    void queryClient.invalidateQueries({ queryKey });
  };
  const onError = (failure: Error) => setError(failure.message);

  const createMutation = useMutation({
    mutationFn: (input: SavedViewRecordInput) => backend.create(input),
    onSuccess: created => updateCachedViews(records => [...records, created]),
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: ({ viewId, patch }: { viewId: string; patch: Partial<SavedViewRecordInput> }) =>
      backend.update(viewId, patch),
    onSuccess: updated =>
      updateCachedViews(records => records.map(record => (record.id === updated.id ? updated : record))),
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: (viewId: string) => backend.remove(viewId),
    onSuccess: (_result, viewId) => updateCachedViews(records => records.filter(record => record.id !== viewId)),
    onError,
  });

  const views = (list.data ?? []).flatMap(record => parseSavedView(record, schema) ?? []);
  const activeView = views.find(view => view.id === activeViewId);
  const find = (viewId: string) => views.find(view => view.id === viewId);
  const shown = current ?? activeView?.state;

  return {
    views,
    activeView,
    isLoading: list.isPending,
    loadError: list.error ?? undefined,
    error,
    unsaved: activeView !== undefined && current !== undefined && !isSameState(current, activeView.state),
    pending: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
    creating,
    select: viewId => {
      setError(undefined);
      if (viewId === undefined) {
        onApply(undefined);
        return;
      }
      const view = find(viewId);
      if (view) onApply(view);
    },
    startCreating: () => {
      setError(undefined);
      setCreating(true);
    },
    cancelCreating: () => setCreating(false),
    create: name => {
      const validName = validViewName(name);
      if (!validName || shown === undefined) {
        setCreating(false);
        return;
      }
      setError(undefined);
      createMutation.mutate(
        { name: validName, state: shown },
        {
          onSuccess: created => onActiveViewChange(created.id),
          onSettled: () => setCreating(false),
        },
      );
    },
    save: options => {
      if (!activeView || current === undefined) return;
      setError(undefined);
      updateMutation.mutate({ viewId: activeView.id, patch: { state: current } }, { onSuccess: options?.onSaved });
    },
    reset: () => {
      if (!activeView) return;
      setError(undefined);
      onApply(activeView);
    },
    rename: (viewId, name) => {
      const validName = validViewName(name);
      const view = find(viewId);
      if (!validName || !view || validName === view.name) return;
      setError(undefined);
      updateMutation.mutate({ viewId, patch: { name: validName } });
    },
    duplicate: viewId => {
      const original = find(viewId);
      if (!original) return;
      setError(undefined);
      createMutation.mutate(
        { name: validViewName(`${original.name} copy`) ?? original.name, state: original.state },
        {
          onSuccess: created => {
            const copy = parseSavedView(created, schema);
            if (copy) onApply(copy);
          },
        },
      );
    },
    remove: viewId => {
      setError(undefined);
      removeMutation.mutate(viewId, {
        onSuccess: () => {
          if (viewId === activeViewId) onActiveViewChange(undefined);
        },
      });
    },
  };
}
