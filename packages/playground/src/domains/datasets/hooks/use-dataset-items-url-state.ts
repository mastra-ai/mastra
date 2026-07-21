import { useCallback, useMemo } from 'react';

const TAB_PARAM = 'tab';
const VERSION_PARAM = 'version';
const PANEL_PARAM = 'panel';
const MODE_PARAM = 'mode';

const TAB_VALUES = new Set(['items', 'experiments', 'review'] as const);
export type DatasetTab = 'items' | 'experiments' | 'review';

const PANEL_VALUES = new Set(['versions'] as const);
export type DatasetPanel = 'versions';

const NON_IDLE_SELECTION_MODES = new Set([
  'export',
  'export-json',
  'create-dataset',
  'add-to-dataset',
  'delete',
  'compare-items',
] as const);
export type DatasetSelectionMode =
  'idle' | 'export' | 'export-json' | 'create-dataset' | 'add-to-dataset' | 'delete' | 'compare-items';

export type SetURLSearchParamsLike = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean; preventScrollReset?: boolean; state?: unknown },
) => void;

export interface UseDatasetItemsUrlStateResult {
  tab: DatasetTab;
  activeVersion: number | null;
  panel: DatasetPanel | null;
  selectionMode: DatasetSelectionMode;

  handleTabChange: (tab: DatasetTab) => void;
  handleVersionChange: (version: number | null) => void;
  handlePanelChange: (panel: DatasetPanel | null) => void;
  handleSelectionModeChange: (mode: DatasetSelectionMode) => void;
}

/**
 * URL-derived state for the dataset detail view. Owns the `tab`, `version`,
 * `panel`, and `mode` search params plus the handlers that mutate them.
 * Router-agnostic — pass `searchParams` and `setSearchParams` from the host router.
 *
 * Leaving the items tab clears `panel` and `mode` since both are items-tab concepts;
 * `version` persists across tabs to match the prior in-memory behavior.
 */
export function useDatasetItemsUrlState(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
): UseDatasetItemsUrlStateResult {
  const tab = useMemo<DatasetTab>(() => {
    const value = searchParams.get(TAB_PARAM);
    return value && TAB_VALUES.has(value as DatasetTab) ? (value as DatasetTab) : 'items';
  }, [searchParams]);

  const activeVersion = useMemo<number | null>(() => {
    const value = searchParams.get(VERSION_PARAM);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const panel = useMemo<DatasetPanel | null>(() => {
    const value = searchParams.get(PANEL_PARAM);
    return value && PANEL_VALUES.has(value as DatasetPanel) ? (value as DatasetPanel) : null;
  }, [searchParams]);

  const selectionMode = useMemo<DatasetSelectionMode>(() => {
    const value = searchParams.get(MODE_PARAM);
    return value && NON_IDLE_SELECTION_MODES.has(value as Exclude<DatasetSelectionMode, 'idle'>)
      ? (value as DatasetSelectionMode)
      : 'idle';
  }, [searchParams]);

  const handleTabChange = useCallback(
    (next: DatasetTab) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next === 'items') {
            params.delete(TAB_PARAM);
          } else {
            params.set(TAB_PARAM, next);
            params.delete(PANEL_PARAM);
            params.delete(MODE_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleVersionChange = useCallback(
    (next: number | null) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next == null) {
            params.delete(VERSION_PARAM);
          } else {
            params.set(VERSION_PARAM, String(next));
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handlePanelChange = useCallback(
    (next: DatasetPanel | null) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (!next) {
            params.delete(PANEL_PARAM);
          } else {
            params.set(PANEL_PARAM, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSelectionModeChange = useCallback(
    (next: DatasetSelectionMode) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next === 'idle') {
            params.delete(MODE_PARAM);
          } else {
            params.set(MODE_PARAM, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    tab,
    activeVersion,
    panel,
    selectionMode,
    handleTabChange,
    handleVersionChange,
    handlePanelChange,
    handleSelectionModeChange,
  };
}
