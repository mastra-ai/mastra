import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Sparkles, FileText, Zap } from 'lucide-react';
import type { SearchResponse, SearchResult } from '../hooks/use-knowledge';

interface SearchKnowledgePanelProps {
  onSearch: (params: { query: string; topK?: number; mode?: 'vector' | 'bm25' | 'hybrid' }) => void;
  isSearching: boolean;
  searchResults?: SearchResponse;
  hasBM25: boolean;
  hasVector: boolean;
  onViewResult?: (key: string) => void;
}

type SearchMode = 'vector' | 'bm25' | 'hybrid';

const modeConfig: Record<SearchMode, { label: string; icon: React.ReactNode; color: string }> = {
  bm25: {
    label: 'Keyword',
    icon: <FileText className="h-3.5 w-3.5" />,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  vector: {
    label: 'Semantic',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Zap className="h-3.5 w-3.5" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
};

export function SearchKnowledgePanel({
  onSearch,
  isSearching,
  searchResults,
  hasBM25,
  hasVector,
  onViewResult,
}: SearchKnowledgePanelProps) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);

  const getDefaultMode = (): SearchMode => {
    if (hasBM25 && hasVector) return 'hybrid';
    if (hasBM25) return 'bm25';
    if (hasVector) return 'vector';
    return 'bm25';
  };

  const [mode, setMode] = useState<SearchMode>(getDefaultMode());

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch({ query: query.trim(), topK, mode });
  };

  const availableModes = [
    ...(hasBM25 ? (['bm25'] as const) : []),
    ...(hasVector ? (['vector'] as const) : []),
    ...(hasBM25 && hasVector ? (['hybrid'] as const) : []),
  ];

  return (
    <div className="rounded-lg bg-surface4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="p-4">
        <div className="flex gap-3 items-center">
          {/* Query Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-icon3" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search knowledge..."
              className="pl-9 h-10 bg-surface2 border-border1"
            />
          </div>

          {/* Top K */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-icon4">Top</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={e => setTopK(parseInt(e.target.value) || 5)}
              className="w-14 h-10 text-center bg-surface2 border-border1"
              title="Number of results"
            />
          </div>

          {/* Search Button */}
          <Button type="submit" disabled={isSearching || !query.trim()} size="lg" className="h-10 px-4">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Mode Selection */}
        <div className="flex gap-2 mt-3">
          {availableModes.map(m => {
            const config = modeConfig[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors
                  ${isActive ? config.color : 'bg-surface2 text-icon4 border-transparent hover:bg-surface3'}
                `}
              >
                {config.icon}
                {config.label}
              </button>
            );
          })}
        </div>
      </form>

      {/* Results */}
      {searchResults && (
        <div className="border-t border-border1">
          <div className="px-4 py-2 flex items-center justify-between text-xs">
            <span className="text-icon4">
              {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''} for "
              <span className="text-icon6">{searchResults.query}</span>"
            </span>
            <span className={`px-1.5 py-0.5 rounded ${modeConfig[searchResults.mode].color}`}>
              {modeConfig[searchResults.mode].label}
            </span>
          </div>

          {searchResults.results.length === 0 ? (
            <div className="px-4 py-8 text-center text-icon4 text-sm">No results found. Try a different query.</div>
          ) : (
            <ul className="max-h-[320px] overflow-auto">
              {searchResults.results.map((result, index) => (
                <SearchResultItem
                  key={`${result.key}-${index}`}
                  result={result}
                  rank={index + 1}
                  onClick={() => onViewResult?.(result.key)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  rank: number;
  onClick?: () => void;
}

function SearchResultItem({ result, rank, onClick }: SearchResultItemProps) {
  const scorePercent = Math.min(100, Math.max(0, result.score * 100));

  return (
    <li className="border-t border-border1 first:border-t-0">
      <button onClick={onClick} className="w-full px-4 py-3 text-left hover:bg-surface5 transition-colors flex gap-3">
        <span className="text-xs text-icon3 tabular-nums w-4 flex-shrink-0">{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-icon6 truncate">{result.key}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-surface2 overflow-hidden">
                <div className="h-full rounded-full bg-accent1" style={{ width: `${scorePercent}%` }} />
              </div>
              <span className="text-[0.625rem] text-icon3 tabular-nums">{result.score.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-icon4 line-clamp-2">{result.content}</p>
        </div>
      </button>
    </li>
  );
}
