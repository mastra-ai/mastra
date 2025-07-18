import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

// Simple relative time formatter
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

interface MemorySearchResult {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  threadId?: string;
  threadTitle?: string;
  context?: {
    before?: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
    after?: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
  };
}

interface MemorySearchProps {
  searchMemory: (query: string) => Promise<{
    results: MemorySearchResult[];
    count: number;
    query: string;
    searchType?: string;
  }>;
  onResultClick?: (messageId: string) => void;
  className?: string;
}

export const MemorySearch = ({ searchMemory, onResultClick, className }: MemorySearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await searchMemory(searchQuery);
      setResults(response.results);
      setIsOpen(response.results.length > 0);
    } catch (err) {
      setError('Failed to search memory');
      console.error('Memory search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchMemory]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  }, [handleSearch]);

  // Handle Enter key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Clear any pending timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      // Perform search immediately
      handleSearch(query);
    }
  }, [query, handleSearch]);

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

  const handleResultClick = (messageId: string) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    onResultClick?.(messageId);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className={cn("flex flex-col h-full", className)} ref={dropdownRef}>
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-icon3" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search memory..."
          className="pl-10 pr-10 bg-surface3 border-border1"
        />
        {query && (
          <Button
            onClick={clearSearch}
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search results dropdown */}
      {(isOpen || (query && results.length === 0 && !isSearching)) && (
        <div className="mt-2 flex-1 bg-surface3 border border-border1 rounded-lg shadow-lg overflow-y-auto">
          {error ? (
            <div className="p-4 text-center">
              <Txt variant="ui-sm" className="text-red-500">{error}</Txt>
            </div>
          ) : isSearching ? (
            <div className="p-4 text-center">
              <Txt variant="ui-sm" className="text-icon3">Searching...</Txt>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center">
              <Txt variant="ui-sm" className="text-icon3">No results found for "{query}"</Txt>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result.id)}
                  className="w-full px-4 py-3 hover:bg-surface4 transition-colors duration-150 text-left border-b border-border1 last:border-b-0"
                >
                  <div className="flex flex-col gap-2">
                    {/* Context before */}
                    {result.context?.before && result.context.before.length > 0 && (
                      <div className="opacity-50 text-xs space-y-1">
                        {result.context.before.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="font-medium">{msg.role}:</span>
                            <span className="text-icon3">{truncateContent(msg.content, 50)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Main result */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            result.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                          )}>
                            {result.role}
                          </span>
                          <Txt variant="ui-xs" className="text-icon3">
                            {formatRelativeTime(new Date(result.createdAt))}
                          </Txt>
                          {result.threadTitle && (
                            <Txt variant="ui-xs" className="text-icon3 truncate max-w-[150px]" title={result.threadTitle}>
                              • {result.threadTitle}
                            </Txt>
                          )}
                        </div>
                        <Txt variant="ui-sm" className="text-icon5 break-words">
                          {truncateContent(result.content)}
                        </Txt>
                      </div>
                    </div>
                    
                    {/* Context after */}
                    {result.context?.after && result.context.after.length > 0 && (
                      <div className="opacity-50 text-xs space-y-1">
                        {result.context.after.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="font-medium">{msg.role}:</span>
                            <span className="text-icon3">{truncateContent(msg.content, 50)}</span>
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