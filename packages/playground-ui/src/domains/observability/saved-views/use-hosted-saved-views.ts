import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { applySavedView, savedViewFromSearchParams } from '../saved-view-state';
import { SavedViewNameTakenError, savedViewsQueryKey } from './saved-views-source';
import type { SavedViewRecord, SavedViewsSource } from './saved-views-source';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import type { FilterBarItem } from '@/ds/components/FilterBar/types';
import { savedViewNameSchema } from '@/ds/components/SavedViews/saved-view-schema';
import type { SavedView } from '@/ds/components/SavedViews/saved-view-schema';
import type { SavedViewDraft, SavedViewsController } from '@/ds/components/SavedViews/use-saved-views';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';

/** Same limit as the saved view schema in `@mastra/core`, checked before a request is made. */
export const SAVED_VIEW_STATE_MAX_BYTES = 16 * 1024;

const NEW_VIEW_NAME = 'Untitled view';
export const SAVED_VIEW_TOO_LARGE_MESSAGE =
  'This view is too large to save (16 KiB max). Remove some filters or columns.';
const SAVE_FAILED_MESSAGE = 'Could not save the view. Try again.';
const DELETE_FAILED_MESSAGE = 'Could not delete the view. Try again.';

export type HostedSavedViewSettings = Pick<SavedViewRecord, 'state' | 'scope'>;

export type SavedViewColumnsControl = {
  preferences: TraceColumnPreferences;
  setPreferences: (next: TraceColumnPreferences) => void;
};

export type UseHostedSavedViewsArgs = {
  page: SavedViewPage;
  source: SavedViewsSource;
  queryKeyScope: readonly unknown[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
  /** The page's column picker; omitted on pages with fixed columns. */
  columns?: SavedViewColumnsControl;
};

const stateBytes = (state: SavedViewState) => new TextEncoder().encode(JSON.stringify(state)).length;

/** The filters a view's hover summary lists: its top-level filters (groups are counted separately). */
function summaryFilters(state: SavedViewState): FilterBarItem[] {
  return state.filters.flatMap((node, index) =>
    'nodes' in node
      ? []
      : [
          {
            id: `${index}`,
            fieldId: node.fieldId,
            operatorId: node.operatorId ?? (Array.isArray(node.value) ? 'in' : 'is'),
            value: node.value,
          },
        ],
  );
}

/** The parts of a view that compare equal when they set the same URL and columns. */
function comparable(state: SavedViewState, withColumns: boolean): string {
  const { filters, dateRange, sort, options, columns } = state;
  return JSON.stringify([filters, dateRange ?? null, sort ?? null, options ?? null, withColumns ? columns : null]);
}

function errorMessage(error: unknown, name: string): string {
  return error instanceof SavedViewNameTakenError ? `A view named "${name}" already exists.` : SAVE_FAILED_MESSAGE;
}

const validName = (name: string) => {
  const parsed = savedViewNameSchema.safeParse(name);
  return parsed.success ? parsed.data : undefined;
};

/**
 * Saved views of one observability page, stored by the host's `SavedViewsSource`. The page URL is
 * the draft: picking a view writes its state to the URL (and its columns to the column picker), and
 * the view shows unsaved changes while the URL differs from it.
 */
export function useHostedSavedViews({
  page,
  source,
  queryKeyScope,
  searchParams,
  setSearchParams,
  columns,
}: UseHostedSavedViewsArgs): SavedViewsController<HostedSavedViewSettings> {
  const queryClient = useQueryClient();
  const queryKey = savedViewsQueryKey(queryKeyScope, page);
  const { data: records = [] } = useQuery({ queryKey, queryFn: () => source.list(page) });

  // `undefined`: nothing picked yet, so the view matching the URL (e.g. after a reload) is active.
  // `null`: the page default was picked.
  const [pickedId, setPickedId] = useState<string | null>();
  const [creatingName, setCreatingName] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const columnPreferences = columns?.preferences;
  const current = useMemo(
    () => savedViewFromSearchParams(page, searchParams, { columns: columnPreferences }),
    [page, searchParams, columnPreferences],
  );

  // A view as the page would hold it once applied, so a view saved by an older page (or with stale
  // parts) still compares equal to the URL it sets.
  const matchesUrl = (state: SavedViewState) => {
    const applied = applySavedView(state, new URLSearchParams());
    const normalized = savedViewFromSearchParams(page, applied.params, { columns: applied.columns });
    const withColumns = applied.columns !== undefined;
    return comparable(normalized, withColumns) === comparable(current, withColumns);
  };

  const activeRecord =
    pickedId === undefined
      ? records.find(record => matchesUrl(record.state))
      : records.find(record => record.id === pickedId);
  const activeUnsaved = activeRecord !== undefined && !matchesUrl(activeRecord.state);

  const toView = (
    record: Pick<SavedViewRecord, 'id' | 'name' | 'state' | 'scope'>,
  ): SavedView<HostedSavedViewSettings> => ({
    id: record.id,
    name: record.name,
    filters: summaryFilters(record.state),
    settings: { state: record.state, scope: record.scope },
  });
  const views = records.map(toView);
  const activeView = activeRecord ? toView(activeRecord) : undefined;

  let draft: SavedViewDraft<HostedSavedViewSettings> | undefined;
  if (creatingName !== undefined) {
    draft = { name: creatingName, filters: summaryFilters(current), settings: { state: current } };
  } else if (activeRecord && activeUnsaved) {
    draft = {
      viewId: activeRecord.id,
      name: activeRecord.name,
      filters: summaryFilters(current),
      settings: { state: current },
    };
  }

  const applyState = (state: SavedViewState) => {
    const applied = applySavedView(state, searchParams);
    setSearchParams(previous => applySavedView(state, previous).params);
    if (applied.columns && columns) columns.setPreferences(applied.columns);
  };

  const storeRecord = (record: SavedViewRecord) =>
    queryClient.setQueryData<SavedViewRecord[]>(queryKey, (list = []) =>
      list.some(item => item.id === record.id)
        ? list.map(item => (item.id === record.id ? record : item))
        : [record, ...list],
    );

  const run = async <T>(task: () => Promise<T>, onError: (error: unknown) => string): Promise<T | undefined> => {
    setPending(true);
    setError(undefined);
    try {
      return await task();
    } catch (cause) {
      setError(onError(cause));
      return undefined;
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const fitsSizeLimit = (state: SavedViewState) => {
    if (stateBytes(state) <= SAVED_VIEW_STATE_MAX_BYTES) return true;
    setError(SAVED_VIEW_TOO_LARGE_MESSAGE);
    return false;
  };

  const select = (viewId: string | undefined) => {
    setCreatingName(undefined);
    setError(undefined);
    if (viewId === undefined) {
      setPickedId(null);
      applyState({ schemaVersion: 1, page, filters: [] });
      return;
    }
    const record = records.find(item => item.id === viewId);
    if (!record) return;
    setPickedId(record.id);
    applyState(record.state);
  };

  return {
    views,
    activeView,
    draft,
    unsaved: creatingName !== undefined || activeUnsaved,
    error,
    pending,
    applied: draft ?? activeView,
    select,
    create: () => {
      setError(undefined);
      setCreatingName(NEW_VIEW_NAME);
    },
    edit: viewId => {
      if (viewId !== activeRecord?.id) select(viewId);
    },
    change: ({ name }) => {
      if (name !== undefined && creatingName !== undefined) setCreatingName(name);
    },
    save: async () => {
      if (pending || !fitsSizeLimit(current)) return;
      if (creatingName !== undefined) {
        const name = validName(creatingName) ?? NEW_VIEW_NAME;
        const record = await run(
          () => source.create({ name, state: current }),
          cause => errorMessage(cause, name),
        );
        if (!record) return;
        storeRecord(record);
        setCreatingName(undefined);
        setPickedId(record.id);
        return;
      }
      if (!activeRecord || !activeUnsaved) return;
      const { id, name } = activeRecord;
      const record = await run(
        () => source.update(id, { state: current }),
        cause => errorMessage(cause, name),
      );
      if (record) storeRecord(record);
    },
    discard: () => {
      setError(undefined);
      if (creatingName !== undefined) setCreatingName(undefined);
      else if (activeRecord) applyState(activeRecord.state);
    },
    rename: async (viewId, rawName) => {
      const name = validName(rawName);
      const record = records.find(item => item.id === viewId);
      if (!name || !record || name === record.name || pending) return;
      const renamed = await run(
        () => source.update(viewId, { name }),
        cause => errorMessage(cause, name),
      );
      if (renamed) storeRecord(renamed);
    },
    duplicate: async viewId => {
      const original = records.find(item => item.id === viewId);
      if (!original || pending || !fitsSizeLimit(original.state)) return;
      const name = validName(`${original.name} copy`) ?? original.name;
      const copy = await run(
        () => source.create({ name, state: original.state }),
        cause => errorMessage(cause, name),
      );
      if (!copy) return;
      storeRecord(copy);
      setCreatingName(undefined);
      setPickedId(copy.id);
      applyState(copy.state);
    },
    remove: async viewId => {
      if (pending) return;
      const removed = await run(
        async () => {
          await source.remove(viewId);
          return true;
        },
        () => DELETE_FAILED_MESSAGE,
      );
      if (!removed) return;
      queryClient.setQueryData<SavedViewRecord[]>(queryKey, (list = []) => list.filter(item => item.id !== viewId));
      // The page keeps its filters; the default tab is picked so the deleted view is not re-matched.
      if (activeRecord?.id === viewId) setPickedId(null);
    },
  };
}
