import { useCallback, useEffect, useRef, useState } from 'react';

/** A tool-backed value: the latest load for `key`, with the previous key's value kept on screen while it runs. */
export type ToolQuery<T> = {
  data?: T;
  /** Nothing to show yet: the first load for this key is running. */
  isLoading: boolean;
  /** A load for this key is running. */
  isFetching: boolean;
  /** `data` is the previous key's, kept while this key loads. */
  isPlaceholderData: boolean;
  error?: Error;
  retry: () => void;
};

type QueryState<T> = { token?: string; data?: T; error?: Error };

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/**
 * Loads `key`'s value once, and again whenever `key` changes. An `undefined` key loads nothing. A result that
 * arrives after the key moved on is dropped, so a slow answer never replaces a newer one.
 */
export function useToolQuery<T>(key: string | undefined, load: () => Promise<T>): ToolQuery<T> {
  const loadRef = useRef(load);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QueryState<T>>({});

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === undefined) return;
    const token = `${attempt}:${key}`;
    let current = true;
    loadRef.current().then(
      data => current && setState({ token, data }),
      (error: unknown) => current && setState({ token, error: toError(error) }),
    );
    return () => {
      current = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);

  if (key === undefined) return { isLoading: false, isFetching: false, isPlaceholderData: false, retry };
  const isFetching = state.token !== `${attempt}:${key}`;
  return {
    data: state.data,
    isLoading: isFetching && state.data === undefined,
    isFetching,
    isPlaceholderData: isFetching && state.data !== undefined,
    error: isFetching ? undefined : state.error,
    retry,
  };
}

/** One page of a cursor-paged list: its rows, and the cursor of the page after it when there is one. */
export type ToolPage<Row, Cursor> = { rows: Row[]; next?: Cursor };

/** A tool-backed paged list: the pages loaded so far for `key`. */
export type ToolPages<Row> = {
  rows: Row[];
  /** Nothing to show yet: the first page for this key is loading. */
  isLoading: boolean;
  /** A page for this key is loading. */
  isFetching: boolean;
  isFetchingNextPage: boolean;
  /** `rows` are the previous key's, kept while this key's first page loads. */
  isPlaceholderData: boolean;
  hasNextPage: boolean;
  error?: Error;
  loadMore: () => void;
  retry: () => void;
};

type PagesState<Row, Cursor> = {
  token?: string;
  rows: Row[];
  next?: Cursor;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  error?: Error;
};

/**
 * Loads `key`'s first page, and again from the start whenever `key` changes; `loadMore` adds the next page.
 * The previous key's rows stay on screen until the new first page arrives. A failed next page keeps the rows
 * already loaded and stops paging until `retry`, which asks for that page again.
 */
export function useToolPages<Row, Cursor>(
  key: string | undefined,
  loadPage: (cursor: Cursor | undefined) => Promise<ToolPage<Row, Cursor>>,
): ToolPages<Row> {
  const loadRef = useRef(loadPage);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PagesState<Row, Cursor>>({
    rows: [],
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  // Read by `loadMore`, which runs between renders: updated with every commit so a second call in the same tick
  // sees the page already loading.
  const stateRef = useRef(state);
  const generation = useRef(0);
  const token = key === undefined ? undefined : `${attempt}:${key}`;
  const tokenRef = useRef(token);

  useEffect(() => {
    loadRef.current = loadPage;
    tokenRef.current = token;
  });

  const commit = useCallback((update: (previous: PagesState<Row, Cursor>) => PagesState<Row, Cursor>) => {
    stateRef.current = update(stateRef.current);
    setState(stateRef.current);
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    const current = ++generation.current;
    loadRef.current(undefined).then(
      page => {
        if (current !== generation.current) return;
        commit(() => ({
          token,
          rows: page.rows,
          next: page.next,
          hasNextPage: page.next !== undefined,
          isFetchingNextPage: false,
        }));
      },
      (error: unknown) => {
        if (current !== generation.current) return;
        commit(() => ({ token, rows: [], hasNextPage: false, isFetchingNextPage: false, error: toError(error) }));
      },
    );
  }, [token, commit]);

  const fetchNext = useCallback(
    (afterError: boolean) => {
      const previous = stateRef.current;
      if (!previous.hasNextPage || previous.isFetchingNextPage || (previous.error && !afterError)) return;
      const current = generation.current;
      const cursor = previous.next;
      commit(state => ({ ...state, isFetchingNextPage: true, error: undefined }));
      loadRef.current(cursor).then(
        page => {
          if (current !== generation.current) return;
          commit(state => ({
            ...state,
            rows: [...state.rows, ...page.rows],
            next: page.next,
            hasNextPage: page.next !== undefined,
            isFetchingNextPage: false,
          }));
        },
        (error: unknown) => {
          if (current !== generation.current) return;
          commit(state => ({ ...state, isFetchingNextPage: false, error: toError(error) }));
        },
      );
    },
    [commit],
  );

  const loadMore = useCallback(() => {
    if (stateRef.current.token === undefined || stateRef.current.token !== tokenRef.current) return;
    fetchNext(false);
  }, [fetchNext]);

  const retry = useCallback(() => {
    const previous = stateRef.current;
    if (previous.error && previous.rows.length > 0 && previous.token === tokenRef.current) fetchNext(true);
    else setAttempt(value => value + 1);
  }, [fetchNext]);

  if (token === undefined) {
    return {
      rows: [],
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      isPlaceholderData: false,
      hasNextPage: false,
      loadMore,
      retry,
    };
  }
  const isFirstPageLoading = state.token !== token;
  return {
    rows: state.rows,
    // The previous key's rows stay up while the next first page loads, unless that key failed.
    isLoading: isFirstPageLoading && (state.token === undefined || state.error !== undefined),
    isFetching: isFirstPageLoading || state.isFetchingNextPage,
    isFetchingNextPage: !isFirstPageLoading && state.isFetchingNextPage,
    isPlaceholderData: isFirstPageLoading && state.token !== undefined && state.error === undefined,
    hasNextPage: !isFirstPageLoading && state.hasNextPage,
    error: isFirstPageLoading ? undefined : state.error,
    loadMore,
    retry,
  };
}
