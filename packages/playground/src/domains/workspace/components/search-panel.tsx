import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Loader2, Sparkles, FileText, Zap, FolderOpen } from 'lucide-react';
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
    icon: <FileText className="h-3.5 w-3.5" />,
    color: 'bg-badge-blue-strong text-badge-blue-foreground border-badge-blue-edge',
  },
  vector: {
    label: 'Semantic',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    color: 'bg-badge-purple-strong text-badge-purple-foreground border-badge-purple-edge',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Zap className="h-3.5 w-3.5" />,
    color: 'bg-badge-amber-strong text-badge-amber-foreground border-badge-amber-edge',
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
    <div className="rounded-lg bg-muted">
      <Form onSubmit={handleSearch} className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
          <SearchInput
            label="Search workspace files"
            className="flex-1"
            placeholder="Search workspace files..."
            value={query}
            onValueChange={setQuery}
          />

          <Field className="contents">
            <div className="flex items-center gap-1.5">
              <FieldLabel size="smaller">Top</FieldLabel>
              <Input
                type="number"
                min={1}
                max={50}
                value={topK}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopK(parseInt(e.target.value) || 5)}
                className="w-14 border-border bg-background text-center"
                title="Number of results"
              />
            </div>
            <FieldError className="col-span-full row-start-2" />
          </Field>

          <Button type="submit" disabled={isSearching || !query.trim()} size="lg">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {availableModes.length > 0 && (
          <div className="flex gap-2">
            {availableModes.map(m => {
              const config = modeConfig[m];
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-column ${isActive ? config.color : 'state-layer border-transparent bg-background text-muted-foreground'}`}
                >
                  {config.icon}
                  {config.label}
                </button>
              );
            })}
          </div>
        )}
      </Form>

      {searchResults && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 py-2 text-caption">
            <span className="text-muted-foreground">
              {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''} for "
              <span className="text-foreground">{searchResults.query}</span>"
            </span>
            <span className={`rounded px-1.5 py-0.5 ${modeConfig[searchResults.mode].color}`}>
              {modeConfig[searchResults.mode].label}
            </span>
          </div>

          {searchResults.results.length === 0 ? (
            <div className="px-4 py-5 text-center text-body text-muted-foreground">
              No results found. Try a different query.
            </div>
          ) : (
            <ul className="max-h-[320px] overflow-auto">
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
    <li className="border-t border-border first:border-t-0">
      <button onClick={onClick} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-fill-subtle">
        <Txt as="span" variant="caption" tone="muted" className="w-4 shrink-0 tabular-nums">
          {rank}
        </Txt>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Txt as="span" variant="body" tone="ink" font="mono" className="truncate">
              {fileId}
            </Txt>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="h-1 w-12 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-chart-green" style={{ width: `${scorePercent}%` }} />
              </div>
              <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
                {result.score.toFixed(2)}
              </Txt>
            </div>
          </div>
          <Txt variant="caption" tone="muted" className="line-clamp-2">
            {result.content}
          </Txt>
          {result.lineRange && (
            <Txt variant="caption" tone="muted" className="mt-1">
              Lines {result.lineRange.start}–{result.lineRange.end}
            </Txt>
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
      <Form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <SearchInput
            label="Search skills"
            className="flex-1"
            placeholder="Search across skills..."
            value={query}
            onValueChange={setQuery}
          />
          <Button type="submit" disabled={!query.trim() || isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        <div className="flex items-center gap-4 text-body">
          <Field orientation="horizontal">
            <FieldLabel size="smaller">Results:</FieldLabel>
            <Select value={String(topK)} onValueChange={value => setTopK(Number(value))}>
              <SelectTrigger size="sm" className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 10, 20].map(value => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field orientation="horizontal">
            <Checkbox checked={includeReferences} onCheckedChange={checked => setIncludeReferences(checked === true)} />
            <FieldLabel size="smaller">Include references</FieldLabel>
          </Field>
        </div>
      </Form>

      {results.length > 0 && (
        <div className="space-y-2">
          <Txt as="h3" variant="subheading" tone="ink">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </Txt>
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
      className={cn(raisedSurfaceStyle, surfaceStateLayerStyle, 'w-full rounded-lg p-4 text-left')}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded bg-muted p-1.5">
          {isReference ? (
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <SkillIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium text-foreground">{result.skillName}</span>
            <Txt as="span" variant="caption" tone="muted">
              {result.source}
            </Txt>
            <Txt as="span" variant="caption" tone="muted" className="ml-auto">
              Score: {result.score.toFixed(3)}
            </Txt>
          </div>
          <Txt tone="muted" className="line-clamp-3 whitespace-pre-wrap">
            {result.content.slice(0, 300)}
            {result.content.length > 300 && '...'}
          </Txt>
          {result.lineRange && (
            <Txt variant="caption" tone="muted" className="mt-2">
              Lines {result.lineRange.start}–{result.lineRange.end}
            </Txt>
          )}
        </div>
      </div>
    </button>
  );
}
