import { hashKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  isRejectedListRequest,
  OBSERVABILITY_LIST_HEAD_LIMIT,
  OBSERVABILITY_LIST_HEAD_MAX_ROWS,
  OBSERVABILITY_LIST_POLL_INTERVAL_MS,
} from '../list-polling';

/** Rows gathered by head polls since the list loaded, and the latest `endedAt` among them (epoch ms). */
export type ListHeadStore<Row> = { rows: Row[]; watermark: number | undefined };

export type UseListHeadPollArgs<Row> = {
  /** Identifies the list (resource and query). A new key starts an empty head. */
  queryKey: readonly unknown[];
  /** Fetches the newest rows, most recently ended first, for a window ending at `to`. */
  fetchHead: (to: string) => Promise<Row[]>;
  getId: (row: Row) => string;
  getEndedAt: (row: Row) => string | null | undefined;
  enabled: boolean;
  /** When the list rows were loaded (epoch ms). Head rows that all ended after it may hide a gap. */
  since?: number;
  /** The page size `fetchHead` asks for. */
  limit?: number;
  maxRows?: number;
  interval?: number;
  /** Called when head polls can no longer keep the list complete; the list should reload its first page. */
  onOverflow?: () => void;
};

export function listHeadQueryKey(queryKey: readonly unknown[]) {
  return ['observability-list-head', ...queryKey] as const;
}

export type ListWindow = { from: string; to: string };

/**
 * `window` moved to end at `to`. A preset window ("Last 7 days") keeps its length, so a server cap on
 * the length (word search's 7 days) never refuses it while the list is open. With `fixedStart` (a start
 * the user picked, with no end) `from` stays put and the window grows instead.
 */
export function windowEndingAt(window: ListWindow, to: string, fixedStart = false): ListWindow {
  if (fixedStart) return { from: window.from, to };
  const length = Date.parse(window.to) - Date.parse(window.from);
  return { from: new Date(Date.parse(to) - length).toISOString(), to };
}

/**
 * The moved list window after a head-poll overflow. `reanchor` moves the selected window to end now
 * (see `windowEndingAt`), which changes the list's query key so only its first page reloads. A new
 * `selection` drops the anchor.
 */
export function useListAnchor(selection: unknown, fixedStart = false) {
  const selectionHash = hashKey([selection]);
  const [anchor, setAnchor] = useState<{ selectionHash: string; window: ListWindow }>();
  const anchorWindow = anchor?.selectionHash === selectionHash ? anchor.window : undefined;
  /** `selected` is the window the user selected, not the current anchor: each overflow moves it from there. */
  const reanchor = (selected: ListWindow) =>
    setAnchor({ selectionHash, window: windowEndingAt(selected, new Date().toISOString(), fixedStart) });
  return { anchorWindow, reanchor };
}

const emptyStore = <Row>(): ListHeadStore<Row> => ({ rows: [], watermark: undefined });

/**
 * Polls the newest rows of a list that has no server-side delta mode. Rows accumulate by id across
 * polls (the latest version wins) in their own cache entry, so the list's pages and cursors are never
 * touched: callers merge `headRows` into the rendered rows. Nothing is fetched on mount; the first
 * poll runs after one interval. Polling stops once the server rejects the request.
 */
export function useListHeadPoll<Row>({
  queryKey,
  fetchHead,
  getId,
  getEndedAt,
  enabled,
  since,
  limit = OBSERVABILITY_LIST_HEAD_LIMIT,
  maxRows = OBSERVABILITY_LIST_HEAD_MAX_ROWS,
  interval = OBSERVABILITY_LIST_POLL_INTERVAL_MS,
  onOverflow,
}: UseListHeadPollArgs<Row>) {
  const queryClient = useQueryClient();
  const key = listHeadQueryKey(queryKey);

  const { data } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ListHeadStore<Row>> => {
      const previous = queryClient.getQueryData<ListHeadStore<Row>>(key) ?? emptyStore<Row>();
      const fetched = await fetchHead(new Date().toISOString());

      const endedAts = fetched.map(row => Date.parse(getEndedAt(row) ?? '')).filter(Number.isFinite);
      const rows = new Map(previous.rows.map(row => [getId(row), row]));
      for (const row of fetched) rows.set(getId(row), row);

      // A full page that all ended after what was already seen may have pushed rows out of reach.
      const baseline = previous.watermark ?? since;
      const mayHaveGap =
        baseline !== undefined && fetched.length >= limit && endedAts.length > 0 && Math.min(...endedAts) > baseline;
      if (mayHaveGap || rows.size > maxRows) {
        onOverflow?.();
        return emptyStore<Row>();
      }

      const watermark =
        endedAts.length > 0 ? Math.max(previous.watermark ?? -Infinity, ...endedAts) : previous.watermark;
      return { rows: [...rows.values()], watermark };
    },
    initialData: emptyStore<Row>,
    staleTime: Infinity,
    enabled,
    refetchInterval: query => (isRejectedListRequest(query.state.error) ? false : interval),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  return { headRows: data.rows };
}
