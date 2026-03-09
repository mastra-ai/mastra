import { useState, useCallback, useRef } from 'react';

/**
 * Represents the state of a mutation operation.
 * Mimics the essential return type of react-query's useMutation.
 */
export interface MutationState<TData, TError extends Error, TVariables> {
  /** Execute the mutation without waiting for the result */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation and return a promise with the result */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Whether the mutation is currently executing */
  isPending: boolean;
  /** Whether the mutation completed successfully */
  isSuccess: boolean;
  /** Whether the mutation failed with an error */
  isError: boolean;
  /** The error if the mutation failed, null otherwise */
  error: TError | null;
  /** The data returned by the mutation if successful */
  data: TData | undefined;
  /** Reset the mutation state to initial values */
  reset: () => void;
}

/**
 * Internal helper hook that provides mutation-like functionality without react-query.
 * Tracks pending, success, and error states for async operations.
 */
export function useMutation<TData, TError extends Error, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): MutationState<TData, TError, TVariables> {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setData(undefined);
  }, []);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsPending(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const result = await mutationFnRef.current(variables);
      setData(result);
      setIsSuccess(true);
      return result;
    } catch (err) {
      const typedError = err as TError;
      setError(typedError);
      setIsError(true);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error is already captured in state
      });
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    isPending,
    isSuccess,
    isError,
    error,
    data,
    reset,
  };
}
