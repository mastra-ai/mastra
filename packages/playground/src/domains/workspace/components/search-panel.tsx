import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { Search, Loader2, Sparkles, FileText, Zap, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import type { SearchResult, SearchResponse, SkillSearchResult } from '../types';

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
    icon: <FileText className="size-3.5" />,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  vector: {
    label: 'Semantic',
    icon: <Sparkles className="size-3.5" />,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Zap className="size-3.5" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
};

function getWorkspaceSearchResultFileId(result: SearchResult): string {
  return result.id.replace(/#chunk-\d+$/, '');
}

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
        <div className="flex items-center gap-3">
          {/* Query Input */}
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral3" />
            <Input
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search workspace files..."
              variant="outline"
              className="h-10 pl-9"
            />
          </div>

          {/* Top K */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral4">Top</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopK(parseInt(e.target.value) || 5)}
              className="h-10 w-14 border-border1 bg-surface2 text-center"
              title="Number of results"
            />
          </div>

          {/* Search Button */}
          <Button type="submit" disabled={isSearching || !query.trim()} size="lg" className="h-10 px-4">
            {isSearching ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Mode Selection */}
        {availableModes.length > 0 && (
          <div className="mt-3 flex gap-2">
            {availableModes.map(m => {
              const config = modeConfig[m];
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`
                    inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors
                    ${isActive ? config.color : 'border-transparent bg-surface2 text-neutral4 hover:bg-surface3'}
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
          <div className="flex items-center justify-between px-4 py-2 text-xs">
            <span className="text-neutral4">
              {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''} for "
              <span className="text-neutral6">{searchResults.query}</span>"
            </span>
            <span className={`rounded px-1.5 py-0.5 ${modeConfig[searchResults.mode].color}`}>
              {modeConfig[searchResults.mode].label}
            </span>
          </div>

          {searchResults.results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral4">No results found. Try a different query.</div>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {searchResults.results.map((result, index) => (
                <WorkspaceSearchResultItem
                  key={`${result.id}-${index}`}
                  result={result}
                  rank={index + 1}
                  onClick={() => onViewResult?.(getWorkspaceSearchResultFileId(result))}
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
  const fileId = getWorkspaceSearchResultFileId(result);

  return (
    <li className="border-t border-border1 first:border-t-0">
      <button onClick={onClick} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface5">
        <span className="w-4 shrink-0 text-xs text-neutral3 tabular-nums">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <FolderOpen className="size-3.5 shrink-0 text-neutral4" />
            <span className="truncate font-mono text-sm text-neutral6">{fileId}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="h-1 w-12 overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-accent1" style={{ width: `${scorePercent}%` }} />
              </div>
              <span className="text-ui-xs text-neutral3 tabular-nums">{result.score.toFixed(2)}</span>
            </div>
          </div>
          <p className="line-clamp-2 text-xs text-neutral4">{result.content}</p>
          {result.lineRange && (
            <p className="mt-1 text-xs text-neutral3">
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
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral3" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search across skills..."
              className="w-full rounded-lg border border-border1 bg-surface3 py-2 pr-4 pl-10 text-sm text-neutral6 placeholder:text-neutral3 focus:ring-2 focus:ring-accent1 focus:outline-hidden"
            />
          </div>
          <Button type="submit" disabled={!query.trim() || isSearching}>
            {isSearching ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-neutral4">
            <span>Results:</span>
            <select
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}
              className="rounded border border-border1 bg-surface3 px-2 py-1 text-neutral5"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-neutral4">
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
          <h3 className="text-sm font-medium text-neutral5">
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
      className="w-full rounded-lg border border-border1 bg-surface3 p-4 text-left transition-colors hover:border-accent1/50"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded bg-surface5 p-1.5">
          {isReference ? (
            <FileText className="size-3.5 text-neutral4" />
          ) : (
            <SkillIcon className="size-3.5 text-neutral4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium text-neutral6">{result.skillName}</span>
            <span className="text-xs text-neutral3">{result.source}</span>
            <span className="ml-auto text-xs text-neutral3">Score: {result.score.toFixed(3)}</span>
          </div>
          <p className="line-clamp-3 text-sm whitespace-pre-wrap text-neutral4">
            {result.content.slice(0, 300)}
            {result.content.length > 300 && '...'}
          </p>
          {result.lineRange && (
            <p className="mt-2 text-xs text-neutral3">
              Lines {result.lineRange.start}–{result.lineRange.end}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
