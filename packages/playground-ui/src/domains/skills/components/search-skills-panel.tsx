import { useState } from 'react';
import { Search, Wand2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import type { SkillSearchResult } from '../hooks/use-skills';

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
            {isSearching ? (
              <Icon>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Icon>
            ) : (
              'Search'
            )}
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
              <SearchResultCard
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

function SearchResultCard({ result, onClick }: { result: SkillSearchResult; onClick?: () => void }) {
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
