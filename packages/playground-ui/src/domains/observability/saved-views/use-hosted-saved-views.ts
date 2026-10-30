import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { applySavedView, savedViewFromSearchParams } from '../saved-view-state';
import { SavedViewNameTakenError, savedViewsQueryKey } from './saved-views-source';
import type { SavedViewRecord, SavedViewsContextValue } from './saved-views-source';
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

/** A view's state, and for a stored view its record. */
export type HostedSavedViewSettings = { state: SavedViewState; record?: SavedViewRecord };

export type SavedViewColumnsControl = {
  preferences: TraceColumnPreferences;
  setPreferences: (next: TraceColumnPreferences) => void;
  /** Back to the page's default columns, when the page default is picked. */
  resetColumns: () => void;
};

export type UseHostedSavedViewsArgs = SavedViewsContextValue & {
  page: SavedViewPage;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
  /** The page's column picker; omitted on pages with fixed columns. */
  columns?: SavedViewColumnsControl;
  /** The range the page shows when the URL names none, when the host's differs from the page's own. */
  defaultDatePreset?: string;
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
  return JSON.stringify({ filters, dateRange, sort, options, columns: withColumns ? columns : undefined });
}

function errorMessage(error: unknown, name: string): string {
  return error instanceof SavedViewNameTakenError ? `A view named "${name}" already exists.` : SAVE_FAILED_MESSAGE;
}

/** What the user picked: a saved view, or the page default when `id` is undefined. */
type Picked = { id: string | undefined };

/** The unsaved state shown in the bar: a view being created, or edits to the active view. */
function draftOf(
  current: SavedViewState,
  creatingName: string | undefined,
  editedRecord: SavedViewRecord | undefined,
): SavedViewDraft<HostedSavedViewSettings> | undefined {
  const unsaved = { filters: summaryFilters(current), settings: { state: current } };
  if (creatingName !== undefined) return { name: creatingName, ...unsaved };
  if (editedRecord) return { viewId: editedRecord.id, name: editedRecord.name, ...unsaved };
  return undefined;
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
  defaultDatePreset,
  canEdit = () => true,
}: UseHostedSavedViewsArgs): SavedViewsController<HostedSavedViewSettings> {
  const queryClient = useQueryClient();
  const queryKey = savedViewsQueryKey(queryKeyScope, page);
  const { data: records = [] } = useQuery({ queryKey, queryFn: () => source.list(page) });

  // Nothing picked yet: the view matching the URL (e.g. after a reload) is active.
  // `{ id: undefined }`: the page default was picked.
  const [picked, setPicked] = useState<Picked>();
  const [creatingName, setCreatingName] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // Bumped whenever the user picks or leaves a view, so a request that settles afterwards does not
  // switch the page back to the view it created.
  const choiceRef = useRef(0);

  const current = savedViewFromSearchParams(page, searchParams, { columns: columns?.preferences });

  // A view as the page would hold it once applied, so a view saved by an older page (or with stale
  // parts) still compares equal to the URL it sets.
  const matchesUrl = (state: SavedViewState) => {
    const applied = applySavedView(state, new URLSearchParams(), { defaultDatePreset });
    const normalized = savedViewFromSearchParams(page, applied.params, { columns: applied.columns });
    const withColumns = applied.columns !== undefined;
    return comparable(normalized, withColumns) === comparable(current, withColumns);
  };

  const activeRecord = picked
    ? records.find(record => record.id === picked.id)
    : records.find(record => matchesUrl(record.state));
  const activeUnsaved = activeRecord !== undefined && !matchesUrl(activeRecord.state);

  const toView = (record: SavedViewRecord): SavedView<HostedSavedViewSettings> => ({
    id: record.id,
    name: record.name,
    filters: summaryFilters(record.state),
    settings: { state: record.state, record },
  });
  const views = records.map(toView);
  const activeView = activeRecord ? toView(activeRecord) : undefined;

  const draft = draftOf(current, creatingName, activeUnsaved ? activeRecord : undefined);

  const applyState = (state: SavedViewState) => {
    const applied = applySavedView(state, searchParams, { defaultDatePreset });
    setSearchParams(previous => applySavedView(state, previous, { defaultDatePreset }).params);
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
    choiceRef.current += 1;
    setCreatingName(undefined);
    setError(undefined);
    if (viewId === undefined) {
      setPicked({ id: undefined });
      applyState({ schemaVersion: 1, page, filters: [] });
      columns?.resetColumns();
      return;
    }
    const record = records.find(item => item.id === viewId);
    if (!record) return;
    setPicked({ id: record.id });
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
      if (name === undefined || creatingName === undefined) return;
      setError(undefined);
      setCreatingName(name);
    },
    save: async () => {
      if (pending || !fitsSizeLimit(current)) return;
      if (creatingName !== undefined) {
        const name = validName(creatingName) ?? NEW_VIEW_NAME;
        const choice = choiceRef.current;
        const record = await run(
          () => source.create({ name, state: current }),
          cause => errorMessage(cause, name),
        );
        if (!record) return;
        storeRecord(record);
        if (choice !== choiceRef.current) return;
        setCreatingName(undefined);
        setPicked({ id: record.id });
        return;
      }
      if (!activeRecord || !activeUnsaved || !canEdit(activeRecord)) return;
      const { id, name } = activeRecord;
      const record = await run(
        () => source.update(id, { state: current }),
        cause => errorMessage(cause, name),
      );
      if (record) storeRecord(record);
    },
    discard: () => {
      choiceRef.current += 1;
      setError(undefined);
      if (creatingName !== undefined) setCreatingName(undefined);
      else if (activeRecord) applyState(activeRecord.state);
    },
    rename: async (viewId, rawName) => {
      const name = validName(rawName);
      const record = records.find(item => item.id === viewId);
      if (!name || !record || name === record.name || pending || !canEdit(record)) return;
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
      const choice = choiceRef.current;
      const copy = await run(
        () => source.create({ name, state: original.state }),
        cause => errorMessage(cause, name),
      );
      if (!copy) return;
      storeRecord(copy);
      if (choice !== choiceRef.current) return;
      setCreatingName(undefined);
      setPicked({ id: copy.id });
      applyState(copy.state);
    },
    remove: async viewId => {
      const record = records.find(item => item.id === viewId);
      if (!record || pending || !canEdit(record)) return;
      choiceRef.current += 1;
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
      if (activeRecord?.id === viewId) setPicked({ id: undefined });
    },
  };
}
