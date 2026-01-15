import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Search, Loader2, Sparkles, FileText, Zap, Wand2, FolderOpen } from 'lucide-react';
import type { SearchResult, SearchResponse } from '../hooks/use-workspace';
import type { SkillSearchResult, SearchSkillsResponse } from '../hooks/use-workspace-skills';

// =============================================================================
// Workspace File Search Panel
// =============================================================================

export interface SearchWorkspacePanelProps {
  onSearch: (params: { query: string; topK?: number; mode?: 'vector' | 'bm25' | 'hybrid' }) => void;
  isSearching: boolean;
  searchResults?: SearchResponse;
  canBM25: boolean;
  canVector: boolean;
  onViewResult?: (id: string) => void;
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

export function SearchWorkspacePanel({
  onSearch,
  isSearching,
  searchResults,
  canBM25,
  canVector,
  onViewResult,
}: SearchWorkspacePanelProps) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);

  const getDefaultMode = (): SearchMode => {
    if (canBM25 && canVector) return 'hybrid';
    if (canBM25) return 'bm25';
    if (canVector) return 'vector';
    return 'bm25';
  };

  const [mode, setMode] = useState<SearchMode>(getDefaultMode());

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch({ query: query.trim(), topK, mode });
  };

  const availableModes = [
    ...(canBM25 ? (['bm25'] as const) : []),
    ...(canVector ? (['vector'] as const) : []),
    ...(canBM25 && canVector ? (['hybrid'] as const) : []),
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search workspace files..."
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopK(parseInt(e.target.value) || 5)}
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
        {availableModes.length > 0 && (
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
        )}
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
                <WorkspaceSearchResultItem
                  key={`${result.id}-${index}`}
                  result={result}
                  rank={index + 1}
                  onClick={() => onViewResult?.(result.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface WorkspaceSearchResultItemProps {
  result: SearchResult;
  rank: number;
  onClick?: () => void;
}

function WorkspaceSearchResultItem({ result, rank, onClick }: WorkspaceSearchResultItemProps) {
  const scorePercent = Math.min(100, Math.max(0, result.score * 100));

  return (
    <li className="border-t border-border1 first:border-t-0">
      <button onClick={onClick} className="w-full px-4 py-3 text-left hover:bg-surface5 transition-colors flex gap-3">
        <span className="text-xs text-icon3 tabular-nums w-4 flex-shrink-0">{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="h-3.5 w-3.5 text-icon4 flex-shrink-0" />
            <span className="font-mono text-sm text-icon6 truncate">{result.id}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-surface2 overflow-hidden">
                <div className="h-full rounded-full bg-accent1" style={{ width: `${scorePercent}%` }} />
              </div>
              <span className="text-[0.625rem] text-icon3 tabular-nums">{result.score.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-icon4 line-clamp-2">{result.content}</p>
          {result.lineRange && (
            <p className="text-xs text-icon3 mt-1">
              Lines {result.lineRange.start}–{result.lineRange.end}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

// =============================================================================
// Skills Search Panel
// =============================================================================

export interface SearchSkillsPanelProps {
  onSearch: (params: { query: string; topK?: number; includeReferences?: boolean }) => void;
  results: SkillSearchResult[];
  isSearching: boolean;
  onResultClick?: (result: SkillSearchResult) => void;
}

export function SearchSkillsPanel({ onSearch, results, isSearching, onResultClick }: SearchSkillsPanelProps) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [includeReferences, setIncludeReferences] = useState(true);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch({ query: query.trim(), topK, includeReferences });
  };

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-icon3" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search across skills..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface3 border border-border1 text-sm text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1"
            />
          </div>
          <Button type="submit" disabled={!query.trim() || isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-icon4">
            <span>Results:</span>
            <select
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}
              className="px-2 py-1 rounded bg-surface3 border border-border1 text-icon5"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-icon4 cursor-pointer">
            <input
              type="checkbox"
              checked={includeReferences}
              onChange={e => setIncludeReferences(e.target.checked)}
              className="rounded border-border1 bg-surface3"
            />
            <span>Include references</span>
          </label>
        </div>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-icon5">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <SkillSearchResultCard
                key={`${result.skillName}-${result.source}-${index}`}
                result={result}
                onClick={() => onResultClick?.(result)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillSearchResultCard({ result, onClick }: { result: SkillSearchResult; onClick?: () => void }) {
  const isReference = result.source !== 'SKILL.md';

  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg bg-surface3 border border-border1 hover:border-accent1/50 text-left transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded bg-surface5 shrink-0 mt-0.5">
          {isReference ? <FileText className="h-3.5 w-3.5 text-icon4" /> : <Wand2 className="h-3.5 w-3.5 text-icon4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-icon6">{result.skillName}</span>
            <span className="text-xs text-icon3">{result.source}</span>
            <span className="ml-auto text-xs text-icon3">Score: {result.score.toFixed(3)}</span>
          </div>
          <p className="text-sm text-icon4 line-clamp-3 whitespace-pre-wrap">
            {result.content.slice(0, 300)}
            {result.content.length > 300 && '...'}
          </p>
          {result.lineRange && (
            <p className="text-xs text-icon3 mt-2">
              Lines {result.lineRange.start}–{result.lineRange.end}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
