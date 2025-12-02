/**
 * Original author: Alex Reardon
 * License: MIT
 * Repo: https://github.com/alexreardon/use-memo-one
 * Description: useMemo and useCallback but with a stable cache.
 */

import { useRef, useState, useEffect } from 'react';
import areInputsEqual from './are-inputs-equal';

interface Cache<T> {
  inputs?: unknown[];
  result: T;
}

export function useMemo<T>(
  // getResult changes on every call,
  getResult: () => T,
  // the inputs array changes on every call
  inputs?: unknown[],
): T {
  // using useState to generate initial value as it is lazy
  const initial: Cache<T> = useState(() => ({
    inputs,
    result: getResult(),
  }))[0];
  const isFirstRun = useRef<boolean>(true);
  const committed = useRef<Cache<T>>(initial);

  // persist any uncommitted changes after they have been committed
  const useCache: boolean =
    isFirstRun.current ||
    Boolean(
      inputs &&
        committed.current.inputs &&
        areInputsEqual(inputs, committed.current.inputs),
    );

  // create a new cache if required
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cache: Cache<T> = useCache
    ? committed.current
    : {
        inputs,
        result: getResult(),
      };

  // commit the cache
  useEffect(() => {
    isFirstRun.current = false;
    committed.current = cache;
  }, [cache]);

  return cache.result;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function useCallback<T extends Function>(
  // getResult changes on every call,
  callback: T,
  // the inputs array changes on every call
  inputs?: unknown[],
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, inputs);
}
