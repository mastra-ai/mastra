import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesQuery } from './match-query';
import type { FilterBarField, FilterBarOption } from './types';

const DEBOUNCE_MS = 150;

export type UseValueSuggestionsOptions = {
  field: FilterBarField | undefined;
  operatorId: string;
  query: string;
  /** Resolver only runs while true (the value editor is open). */
  enabled: boolean;
};

export type UseValueSuggestionsResult = {
  options: FilterBarOption[];
  isLoading: boolean;
  error: unknown;
  /** True when the field has any suggestions (static or lazy). */
  hasSuggestions: boolean;
};

/**
 * Value suggestions for a field. Static lists are filtered locally. Lazy
 * resolvers run only while `enabled`, are debounced on `query`, receive an
 * AbortSignal, and only the latest response is applied.
 */
export function useValueSuggestions({
  field,
  operatorId,
  query,
  enabled,
}: UseValueSuggestionsOptions): UseValueSuggestionsResult {
  const suggestions = field?.suggestions;
  const resolver = typeof suggestions === 'function' ? suggestions : undefined;
  const staticOptions = Array.isArray(suggestions) ? suggestions : undefined;

  const [remote, setRemote] = useState<FilterBarOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const requestId = useRef(0);
  // Consumers typically define the resolver inline; a new identity must not refire (and abort) the request.
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;
  const hasResolver = Boolean(resolver);

  useEffect(() => {
    if (!hasResolver || !enabled) {
      setRemote([]);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    const id = ++requestId.current;
    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => resolverRef.current?.({ query, operatorId, signal: controller.signal }) ?? [])
        .then(result => {
          if (id !== requestId.current) return;
          setRemote(result);
          setError(undefined);
          setIsLoading(false);
        })
        .catch(err => {
          if (id !== requestId.current || controller.signal.aborted) return;
          setError(err);
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasResolver, enabled, query, operatorId]);

  const options = useMemo(() => {
    if (staticOptions) return staticOptions.filter(o => matchesQuery(o.label ?? o.value, query));
    return remote;
  }, [staticOptions, remote, query]);

  return {
    options,
    isLoading: Boolean(resolver) && isLoading,
    error,
    hasSuggestions: Boolean(suggestions),
  };
}
