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
  /**
   * Called when the server refuses a head poll. Return true once the list has moved its window
   * (e.g. a rolling window outgrew a server cap) so polling carries on; otherwise polling stops and
   * the refusal is returned as `error`.
   */
  onRejected?: (error: unknown) => boolean;
};

export function listHeadQueryKey(queryKey: readonly unknown[]) {
  return ['observability-list-head', ...queryKey] as const;
}

/**
 * The moved end of a list window after a head-poll overflow. `reanchor` sets it to now, which changes
 * the list's query key so only its first page reloads. A new `selection` drops the anchor.
 */
export function useListAnchor(selection: unknown) {
  const selectionHash = hashKey([selection]);
  const [anchor, setAnchor] = useState<{ selectionHash: string; from?: string; to: string }>();
  const current = anchor?.selectionHash === selectionHash ? anchor : undefined;
  const reanchor = () => setAnchor({ selectionHash, to: new Date().toISOString() });
  /** Moves the whole window to end now, keeping its length, as a rolling preset resolved again would. */
  const slide = (window: { from: string; to: string }) => {
    const now = Date.now();
    const length = Date.parse(window.to) - Date.parse(window.from);
    setAnchor({ selectionHash, from: new Date(now - length).toISOString(), to: new Date(now).toISOString() });
  };
  return { anchorFrom: current?.from, anchorTo: current?.to, reanchor, slide };
}

const emptyStore = <Row>(): ListHeadStore<Row> => ({ rows: [], watermark: undefined });

/**
 * Polls the newest rows of a list that has no server-side delta mode. Rows accumulate by id across
 * polls (the latest version wins) in their own cache entry, so the list's pages and cursors are never
 * touched: callers merge `headRows` into the rendered rows. Nothing is fetched on mount; the first
 * poll runs after one interval. Polling stops once the server rejects the request, unless `onRejected`
 * recovers the list.
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
  onRejected,
}: UseListHeadPollArgs<Row>) {
  const queryClient = useQueryClient();
  const key = listHeadQueryKey(queryKey);

  const { data, error } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ListHeadStore<Row>> => {
      const previous = queryClient.getQueryData<ListHeadStore<Row>>(key) ?? emptyStore<Row>();
      let fetched: Row[];
      try {
        fetched = await fetchHead(new Date().toISOString());
      } catch (error) {
        if (isRejectedListRequest(error) && onRejected?.(error)) return emptyStore<Row>();
        throw error;
      }

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

  return { headRows: data.rows, error: isRejectedListRequest(error) ? error : null };
}
