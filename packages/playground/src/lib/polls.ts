import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingOptions<TData, TError = Error> {
  /** Async function that fetches the data */
  fetchFn: () => Promise<TData>;
  /** Polling interval in milliseconds */
  interval?: number;
  /** Whether polling is enabled initially */
  enabled?: boolean;
  /** Callback function called with new data */
  onSuccess?: (data: TData) => void;
  /** Callback function called on error */
  onError?: (error: TError) => void;
  /** Function to determine if polling should continue */
  shouldContinue?: (data: TData) => boolean;
}

export interface PollingResult<TData, TError> {
  /** Current polling status */
  isPolling: boolean;
  /** Loading state for current request */
  isLoading: boolean;
  /** Loading state for first call */
  firstCallLoading: boolean;
  /** Current error state */
  error: TError | null;
  /** Latest data received */
  data: TData | null;
  /** Function to start polling */
  startPolling: () => void;
  /** Function to stop polling */
  stopPolling: () => void;
}

export function usePolling<TData, TError = Error>({
  fetchFn,
  interval = 3000,
  enabled = false,
  onSuccess,
  onError,
  shouldContinue = () => true,
}: PollingOptions<TData, TError>): PollingResult<TData, TError> {
  const [isPolling, setIsPolling] = useState(enabled);
  const [error, setError] = useState<TError | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [firstCallLoading, setFirstCallLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    console.log('cleanup');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    console.log('stopPolling');
    setIsPolling(false);
    cleanup();
  }, [cleanup]);

  const startPolling = useCallback(() => {
    console.log('startPolling');
    setIsPolling(true);
    setError(null);
  }, []);

  const executePoll = useCallback(
    async (fistCall: boolean = false) => {
      // Check if component is still mounted
      if (!mountedRef.current) return;
      setIsLoading(true);
      setFirstCallLoading(fistCall);

      try {
        const result = await fetchFn();

        setData(result);
        setError(null);
        onSuccess?.(result);
        setFirstCallLoading(false);

        // Check if we should continue polling
        if (shouldContinue(result)) {
          timeoutRef.current = setTimeout(executePoll, interval);
        } else {
          stopPolling();
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err as TError);
        onError?.(err as TError);
        stopPolling();
      } finally {
        if (mountedRef.current) {
          setFirstCallLoading(false);
          setIsLoading(false);
        }
      }
    },
    [fetchFn, interval, onSuccess, onError, shouldContinue, stopPolling],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (enabled && isPolling) {
      executePoll(true);
    }

    return () => {
      console.log('cleanup poll');
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, isPolling, executePoll, cleanup]);

  return {
    isPolling,
    isLoading,
    error,
    data,
    startPolling,
    stopPolling,
    firstCallLoading,
  };
}

export default usePolling;
