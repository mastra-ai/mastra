import type { MemorySearchResult, MemorySearchResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatRelativeTime } from '@mastra/playground-ui/utils/relative-time';
import { Search, X, ExternalLink } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

interface MemorySearchProps {
  searchMemory: (query: string) => Promise<MemorySearchResponse>;
  onResultClick?: (messageId: string, threadId?: string) => void;
  className?: string;
  currentThreadId?: string;
  chatInputValue?: string;
}

export const MemorySearch = ({
  searchMemory,
  onResultClick,
  className,
  currentThreadId,
  chatInputValue,
}: MemorySearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevThreadIdRef = useRef<string | undefined>(currentThreadId);
  const lastSearchTimeRef = useRef<number>(0);
  const pendingSearchRef = useRef<string | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  // Debounced search
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setError(null);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const response = await searchMemory(searchQuery);
        setResults(response.results);
        setIsOpen(prev => prev || response.results.length > 0);
      } catch (err) {
        setError('Failed to search memory');
        console.error('Memory search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [searchMemory],
  );

  // Handle input change with debouncing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value.trim()) {
        const now = Date.now();
        const timeSinceLastSearch = now - lastSearchTimeRef.current;

        // If it's been more than 500ms since last search, search immediately
        if (timeSinceLastSearch >= 500) {
          setIsSearching(true);
          void handleSearch(value);
          lastSearchTimeRef.current = now;
        } else {
          // Otherwise, set a timeout for the remaining time
          setIsSearching(true); // Show searching state while debouncing
          pendingSearchRef.current = value;
          const remainingTime = 500 - timeSinceLastSearch;
          searchTimeoutRef.current = setTimeout(() => {
            if (pendingSearchRef.current) {
              void handleSearch(pendingSearchRef.current);
              lastSearchTimeRef.current = Date.now();
              pendingSearchRef.current = null;
            }
          }, remainingTime);
        }
      } else {
        setResults([]);
        setIsOpen(false);
        setIsSearching(false);
        pendingSearchRef.current = null;
      }
    },
    [handleSearch],
  );

  // Handle Enter key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Clear any pending timeout
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        // Perform search immediately
        void handleSearch(query);
      }
    },
    [query, handleSearch],
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Re-run search when thread changes if there's a query
  useEffect(() => {
    if (prevThreadIdRef.current !== currentThreadId && query.trim()) {
      // Thread changed and we have a search query, re-run the search
      void handleSearch(query);
    }
    prevThreadIdRef.current = currentThreadId;
  }, [currentThreadId, query, handleSearch]);

  // Sync chat input value with internal state when provided.
  // Keyed on chatInputValue only: re-running on local `query` edits would overwrite the user's typing.
  useEffect(() => {
    if (chatInputValue !== undefined && chatInputValue !== queryRef.current) {
      setQuery(chatInputValue);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (chatInputValue.trim()) {
        const now = Date.now();
        const timeSinceLastSearch = now - lastSearchTimeRef.current;

        // If it's been more than 500ms since last search, search immediately
        if (timeSinceLastSearch >= 500) {
          setIsSearching(true);
          void handleSearch(chatInputValue);
          lastSearchTimeRef.current = now;
        } else {
          // Otherwise, set a timeout for the remaining time
          setIsSearching(true); // Show searching state while debouncing
          pendingSearchRef.current = chatInputValue;
          const remainingTime = 500 - timeSinceLastSearch;
          searchTimeoutRef.current = setTimeout(() => {
            if (pendingSearchRef.current) {
              void handleSearch(pendingSearchRef.current);
              lastSearchTimeRef.current = Date.now();
              pendingSearchRef.current = null;
            }
          }, remainingTime);
        }
      } else {
        setResults([]);
        setIsOpen(false);
        setIsSearching(false);
        pendingSearchRef.current = null;
      }
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [chatInputValue, handleSearch]);

  const handleResultClick = (messageId: string, threadId?: string) => {
    onResultClick?.(messageId, threadId);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className={cn('flex h-full flex-col', className)} ref={dropdownRef}>
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search memory..."
          className="border-border bg-card pr-10 pl-10"
        />
        {query && (
          <Button onClick={clearSearch} className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 transform p-0">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search results dropdown */}
      {(isOpen || (query && (isSearching || results.length === 0))) && (
        <div className={cn(raisedSurfaceStyle, 'mt-2 flex-1 overflow-y-auto rounded-lg')}>
          {error ? (
            <div className="p-4 text-center">
              <Txt variant="caption" className="text-red-500">
                {error}
              </Txt>
            </div>
          ) : isSearching && results.length === 0 ? (
            <div className="p-4 text-center">
              <Txt variant="caption" tone="muted">
                Searching...
              </Txt>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center">
              <Txt variant="caption" tone="muted">
                No results found for "{query}"
              </Txt>
            </div>
          ) : (
            <div className="py-2">
              {results.map(result => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result.id, result.threadId)}
                  className={cn(
                    'w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-fill-subtle',
                    result.threadId !== currentThreadId && 'border-l-2 border-l-blue-400',
                  )}
                >
                  <div className="flex flex-col gap-2">
                    {/* Context before */}
                    {result.context?.before && result.context.before.length > 0 && (
                      <div className="space-y-1 text-caption opacity-50">
                        {result.context.before.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="font-medium">{msg.role}:</span>
                            <span className="text-muted-foreground">{truncateContent(msg.content, 50)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Main result */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded px-2 py-0.5 text-column',
                              result.role === 'user'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-green-500/20 text-green-400',
                            )}
                          >
                            {result.role}
                          </span>
                          <Txt variant="meta" tone="muted" title={formatDate(result.createdAt, 'date-time')}>
                            {formatRelativeTime(result.createdAt)}
                          </Txt>
                          {result.threadTitle && (
                            <div className="flex items-center gap-1">
                              <Txt
                                variant="meta"
                                tone={result.threadId !== currentThreadId ? undefined : 'muted'}
                                className={cn(
                                  'max-w-[150px] truncate',
                                  result.threadId !== currentThreadId && 'text-blue-400',
                                )}
                                title={result.threadTitle}
                              >
                                • {result.threadTitle}
                              </Txt>
                              {result.threadId !== currentThreadId && (
                                <ExternalLink className="h-3 w-3 text-blue-400" />
                              )}
                            </div>
                          )}
                        </div>
                        <Txt variant="caption" tone="ink" className="wrap-break-word">
                          {truncateContent(result.content)}
                        </Txt>
                      </div>
                    </div>

                    {/* Context after */}
                    {result.context?.after && result.context.after.length > 0 && (
                      <div className="space-y-1 text-caption opacity-50">
                        {result.context.after.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="font-medium">{msg.role}:</span>
                            <span className="text-muted-foreground">{truncateContent(msg.content, 50)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
