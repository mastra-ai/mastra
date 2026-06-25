import { SkillIcon } from '@mastra/playground-ui';
import { Searchbar } from '@mastra/playground-ui/components/Searchbar';
import { Loader2, FileText, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchResult, SearchResponse, SkillSearchResult } from '../types';

// Hardcoded query params so the UI stays a simple search box (no per-query knobs).
const SEARCH_TOP_K = 20;
const SEARCH_INCLUDE_REFERENCES = true;

/**
 * Wrap every case-insensitive occurrence of `query` in the text with an accent
 * highlight (reference `<mark>`), so results read like VS Code's search view.
 */
function highlightQuery(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerNeedle, cursor);
    if (matchIndex === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark key={key++} className="rounded-sm bg-accent1/15 px-0.5 text-accent1">
        {text.slice(matchIndex, matchIndex + needle.length)}
      </mark>,
    );
    cursor = matchIndex + needle.length;
  }

  return parts;
}

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

function getDefaultSearchMode(canBM25: boolean, canVector: boolean): SearchMode {
  if (canBM25 && canVector) return 'hybrid';
  if (canVector) return 'vector';
  return 'bm25';
}

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
  const mode = getDefaultSearchMode(canBM25, canVector);

  const handleSearch = (value: string) => {
    const query = value.trim();
    if (!query) return;
    onSearch({ query, topK: SEARCH_TOP_K, mode });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Searchbar onSearch={handleSearch} label="Search workspace files" placeholder="Search workspace files..." />
        </div>
        {isSearching && <Loader2 className="h-4 w-4 animate-spin text-neutral4 shrink-0" />}
      </div>

      {/* Results */}
      {searchResults && (
        <div>
          <div className="py-2 text-xs text-neutral4">
            {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''} for "
            <span className="text-neutral6">{searchResults.query}</span>"
          </div>

          {searchResults.results.length === 0 ? (
            <div className="px-4 py-8 text-center text-neutral4 text-sm">No results found. Try a different query.</div>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-border1 bg-surface4">
              {searchResults.results.map((result, index) => (
                <WorkspaceSearchResultItem
                  key={`${result.id}-${index}`}
                  result={result}
                  query={searchResults.query}
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
  query: string;
  onClick?: () => void;
}

function WorkspaceSearchResultItem({ result, query, onClick }: WorkspaceSearchResultItemProps) {
  const fileId = getWorkspaceSearchResultFileId(result);
  const fileName = fileId.split('/').pop() || fileId;
  const directory = fileId.slice(0, fileId.length - fileName.length).replace(/\/$/, '');

  return (
    <li className="border-t border-border1 first:border-t-0">
      <button onClick={onClick} className="w-full px-3 py-2.5 text-left transition-colors hover:bg-surface5">
        <div className="flex items-baseline gap-2">
          <FolderOpen className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-neutral4" />
          <span className="truncate font-mono text-sm text-neutral6">{fileName}</span>
          {directory && <span className="truncate text-xs text-neutral3">{directory}</span>}
          {result.lineRange && (
            <span className="ml-auto shrink-0 text-xs text-neutral3 tabular-nums">
              L{result.lineRange.start}–{result.lineRange.end}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 pl-5 text-sm text-neutral4">{highlightQuery(result.content, query)}</p>
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
  // Track the last submitted query so result snippets can highlight matches.
  const [submittedQuery, setSubmittedQuery] = useState('');

  const handleSearch = (value: string) => {
    const query = value.trim();
    if (!query) return;
    setSubmittedQuery(query);
    onSearch({ query, topK: SEARCH_TOP_K, includeReferences: SEARCH_INCLUDE_REFERENCES });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Searchbar onSearch={handleSearch} label="Search across skills" placeholder="Search across skills..." />
        </div>
        {isSearching && <Loader2 className="h-4 w-4 animate-spin text-neutral4 shrink-0" />}
      </div>

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
                query={submittedQuery}
                onClick={() => onResultClick?.(result)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillSearchResultCard({
  result,
  query,
  onClick,
}: {
  result: SkillSearchResult;
  query: string;
  onClick?: () => void;
}) {
  const isReference = result.source !== 'SKILL.md';
  const snippet = result.content.slice(0, 300);

  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg bg-surface3 border border-border1 hover:border-accent1/50 text-left transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded bg-surface5 shrink-0 mt-0.5">
          {isReference ? (
            <FileText className="h-3.5 w-3.5 text-neutral4" />
          ) : (
            <SkillIcon className="h-3.5 w-3.5 text-accent1" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-neutral6">{result.skillName}</span>
            <span className="text-xs text-neutral3">{result.source}</span>
            {result.lineRange && (
              <span className="ml-auto shrink-0 text-xs text-neutral3 tabular-nums">
                L{result.lineRange.start}–{result.lineRange.end}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral4 line-clamp-3 whitespace-pre-wrap">
            {highlightQuery(snippet, query)}
            {result.content.length > 300 && '...'}
          </p>
        </div>
      </div>
    </button>
  );
}
