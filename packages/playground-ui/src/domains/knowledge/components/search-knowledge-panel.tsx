import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2, Sparkles, FileText, Zap, ChevronDown, ChevronUp, FileText as FileIcon } from 'lucide-react';
import type { SearchResponse, SearchResult } from '../hooks/use-knowledge';
import { Badge } from '@/ds/components/Badge';

interface SearchKnowledgePanelProps {
  onSearch: (params: { query: string; topK?: number; mode?: 'vector' | 'bm25' | 'hybrid' }) => void;
  isSearching: boolean;
  searchResults?: SearchResponse;
  hasBM25: boolean;
  hasVector: boolean;
  onViewResult?: (key: string) => void;
}

type SearchMode = 'vector' | 'bm25' | 'hybrid';

const modeConfig: Record<SearchMode, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  bm25: {
    label: 'Keyword',
    icon: <FileText className="h-4 w-4" />,
    description: 'BM25 keyword matching',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  vector: {
    label: 'Semantic',
    icon: <Sparkles className="h-4 w-4" />,
    description: 'Vector similarity search',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Zap className="h-4 w-4" />,
    description: 'Combined keyword + semantic',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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
  const [showResults, setShowResults] = useState(true);

  // Determine default search mode based on capabilities
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
    <div className="rounded-xl border border-border1 bg-surface1 overflow-hidden">
      {/* Search Header */}
      <div className="p-4 bg-surface2/50 border-b border-border1">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-icon3" />
          <h3 className="font-medium text-sm">Search Knowledge</h3>
        </div>
        <p className="text-xs text-text3">Search through your artifacts using keyword or semantic search</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="p-4 space-y-4">
        {/* Query Input */}
        <div className="relative">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="pr-24 h-11"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={e => setTopK(parseInt(e.target.value) || 5)}
              className="w-14 h-7 text-xs text-center"
              title="Number of results"
            />
          </div>
        </div>

        {/* Search Mode Selection */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {availableModes.map(m => {
              const config = modeConfig[m];
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all
                    ${
                      isActive
                        ? `${config.color} border-current`
                        : 'bg-surface2 text-text3 border-transparent hover:bg-surface3'
                    }
                  `}
                >
                  {config.icon}
                  <span className="font-medium">{config.label}</span>
                </button>
              );
            })}
          </div>

          <Button type="submit" disabled={isSearching || !query.trim()} size="lg">
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Search Results */}
      {searchResults && (
        <div className="border-t border-border1">
          {/* Results Header */}
          <button
            onClick={() => setShowResults(!showResults)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface2/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''}
              </span>
              <Badge variant="default" className={`text-xs border ${modeConfig[searchResults.mode].color}`}>
                {modeConfig[searchResults.mode].label}
              </Badge>
              <span className="text-xs text-text3 truncate max-w-[200px]">"{searchResults.query}"</span>
            </div>
            {showResults ? (
              <ChevronUp className="h-4 w-4 text-icon3" />
            ) : (
              <ChevronDown className="h-4 w-4 text-icon3" />
            )}
          </button>

          {/* Results List */}
          {showResults && (
            <div className="border-t border-border1">
              {searchResults.results.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="p-3 rounded-full bg-surface2 w-fit mx-auto mb-3">
                    <Search className="h-5 w-5 text-icon3" />
                  </div>
                  <p className="text-sm text-text2">No results found for your query.</p>
                  <p className="text-xs text-text3 mt-1">Try adjusting your search terms or search mode.</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto divide-y divide-border1">
                  {searchResults.results.map((result, index) => (
                    <SearchResultCard
                      key={`${result.key}-${index}`}
                      result={result}
                      rank={index + 1}
                      onClick={() => onViewResult?.(result.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchResultCardProps {
  result: SearchResult;
  rank: number;
  onClick?: () => void;
}

function SearchResultCard({ result, rank, onClick }: SearchResultCardProps) {
  const scorePercent = Math.min(100, Math.max(0, result.score * 100));
  const scoreColor = scorePercent >= 70 ? 'text-green-400' : scorePercent >= 40 ? 'text-amber-400' : 'text-text3';

  return (
    <div className="p-4 hover:bg-surface2 cursor-pointer transition-colors group" onClick={onClick}>
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surface3 flex items-center justify-center text-xs font-medium text-text3">
          {rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon className="h-4 w-4 text-icon3 flex-shrink-0" />
              <span className="font-medium text-sm truncate">{result.key}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-16 h-1.5 rounded-full bg-surface3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${scorePercent >= 70 ? 'bg-green-500' : scorePercent >= 40 ? 'bg-amber-500' : 'bg-gray-500'}`}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <span className={`text-xs font-mono tabular-nums ${scoreColor}`}>{result.score.toFixed(3)}</span>
            </div>
          </div>
          <p className="text-sm text-text2 line-clamp-2 leading-relaxed">{result.content}</p>
          {result.scoreDetails &&
            (result.scoreDetails.vector !== undefined || result.scoreDetails.bm25 !== undefined) && (
              <div className="flex items-center gap-3 mt-2">
                {result.scoreDetails.vector !== undefined && (
                  <span className="text-xs text-text3">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    {result.scoreDetails.vector.toFixed(3)}
                  </span>
                )}
                {result.scoreDetails.bm25 !== undefined && (
                  <span className="text-xs text-text3">
                    <FileText className="h-3 w-3 inline mr-1" />
                    {result.scoreDetails.bm25.toFixed(3)}
                  </span>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
