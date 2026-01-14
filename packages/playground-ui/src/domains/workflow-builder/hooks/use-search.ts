import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';

/**
 * Simple fuzzy search scoring - matches characters in order but not necessarily adjacent
 */
function fuzzyScore(query: string, target: string): number {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match gets highest score
  if (targetLower === queryLower) return 100;

  // Starts with query gets high score
  if (targetLower.startsWith(queryLower)) return 90;

  // Contains query as substring
  if (targetLower.includes(queryLower)) return 80;

  // Fuzzy match - characters appear in order
  let queryIndex = 0;
  let score = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIndex]) {
      score += 10 + consecutiveBonus;
      consecutiveBonus += 5; // Bonus for consecutive matches
      queryIndex++;
    } else {
      consecutiveBonus = 0;
    }
  }

  // All query characters must be found
  if (queryIndex < queryLower.length) return 0;

  return score;
}

/**
 * Search result with score for sorting
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  matches: {
    field: string;
    indices: [number, number][];
  }[];
}

/**
 * Options for the search hook
 */
export interface UseSearchOptions<T> {
  /** Fields to search within each item */
  keys: (keyof T)[];
  /** Minimum score to include in results (0-100) */
  threshold?: number;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Hook for fuzzy searching a list of items
 *
 * @param items - Array of items to search
 * @param options - Search configuration
 * @returns Search state and filtered results
 */
export function useSearch<T>(items: T[], options: UseSearchOptions<T>) {
  const { keys, threshold = 10, limit = 50 } = options;
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) {
      // Return all items with max score when no query
      return items.slice(0, limit).map(item => ({
        item,
        score: 100,
        matches: [],
      }));
    }

    const scored: SearchResult<T>[] = [];

    for (const item of items) {
      let bestScore = 0;
      const matches: SearchResult<T>['matches'] = [];

      for (const key of keys) {
        const value = item[key];
        if (typeof value !== 'string') continue;

        const score = fuzzyScore(query, value);
        if (score > bestScore) {
          bestScore = score;
        }
        if (score > 0) {
          // Find match indices for highlighting
          const indices = findMatchIndices(query.toLowerCase(), value.toLowerCase());
          if (indices.length > 0) {
            matches.push({ field: key as string, indices });
          }
        }
      }

      if (bestScore >= threshold) {
        scored.push({ item, score: bestScore, matches });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }, [items, query, keys, threshold, limit]);

  const clear = useCallback(() => setQuery(''), []);

  return {
    query,
    setQuery,
    clear,
    results,
    hasQuery: query.trim().length > 0,
  };
}

/**
 * Find indices of matched characters for highlighting
 */
function findMatchIndices(query: string, target: string): [number, number][] {
  const indices: [number, number][] = [];
  let queryIndex = 0;
  let matchStart = -1;

  for (let i = 0; i < target.length && queryIndex < query.length; i++) {
    if (target[i] === query[queryIndex]) {
      if (matchStart === -1) matchStart = i;
      queryIndex++;

      // Check if this is the end of a consecutive match
      if (i === target.length - 1 || target[i + 1] !== query[queryIndex]) {
        indices.push([matchStart, i + 1]);
        matchStart = -1;
      }
    } else if (matchStart !== -1) {
      indices.push([matchStart, i]);
      matchStart = -1;
    }
  }

  return indices;
}

/**
 * Highlight matched portions of text
 */
export function highlightMatches(
  text: string,
  indices: [number, number][],
  highlightClass = 'bg-accent1/30 text-accent1',
): React.ReactNode[] {
  if (indices.length === 0) return [text];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const [start, end] of indices) {
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(React.createElement('span', { key: start, className: highlightClass }, text.slice(start, end)));
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
