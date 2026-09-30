import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useEditorSearch } from '../../../hooks/use-editor';
import { HighlightedCode } from './HighlightedCode';

interface SearchPanelProps {
  workspacePath: string | undefined;
  onOpen(path: string, line?: number): void;
}

/**
 * Live content search: queries fire automatically after a short debounce
 * (Enter skips the wait). A two-char minimum is enforced client-side to
 * short-circuit useless queries, and previous results stay on screen while
 * the next query is in flight so typing never flashes an empty panel.
 */
export function SearchPanel({ workspacePath, onOpen }: SearchPanelProps) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState<string | undefined>();
  const search = useEditorSearch(workspacePath, query, { enabled: Boolean(query) });

  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed.length < 2) {
      setQuery(undefined);
      return;
    }
    const timer = window.setTimeout(() => setQuery(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const grouped = useMemo(() => {
    const matches = search.data?.matches ?? [];
    const map = new Map<string, typeof matches>();
    for (const match of matches) {
      const list = map.get(match.path) ?? [];
      list.push(match);
      map.set(match.path, list);
    }
    return Array.from(map.entries());
  }, [search.data]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        className="border-border flex items-center gap-2 border-b px-2 py-2"
        onSubmit={event => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed.length < 2) return;
          setQuery(trimmed);
        }}
      >
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape' && draft) {
              event.preventDefault();
              setDraft('');
              setQuery(undefined);
            }
          }}
          placeholder="Search workspace"
          className="text-body-sm placeholder:text-placeholder min-w-0 flex-1 bg-transparent outline-none"
        />
        {search.isFetching ? (
          <Spinner className="text-muted-foreground size-3.5 shrink-0" />
        ) : draft ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setDraft('');
              setQuery(undefined);
            }}
            className="text-muted-foreground hover:text-foreground grid size-4 shrink-0 place-items-center"
          >
            <X size={12} />
          </button>
        ) : null}
      </form>
      {query && !search.isFetching && grouped.length > 0 && (
        <div
          className="border-border/60 text-meta text-muted-foreground flex shrink-0 items-center justify-between border-b px-3 py-1"
          aria-live="polite"
        >
          <span>
            {search.data?.matches.length} match{search.data?.matches.length === 1 ? '' : 'es'} in {grouped.length}{' '}
            file{grouped.length === 1 ? '' : 's'}
          </span>
          {search.data?.truncated && <span className="text-notice-warning">Truncated</span>}
        </div>
      )}
      <div className="text-caption min-h-0 flex-1 overflow-auto">
        {!search.isFetching && query && grouped.length === 0 && (
          <div className="text-muted-foreground grid h-full place-items-center px-3 py-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search size={20} className="opacity-40" aria-hidden />
              <span>No matches for &ldquo;{query}&rdquo;</span>
            </div>
          </div>
        )}
        {grouped.map(([path, matches]) => (
          <div key={path} className="border-border/50 border-b py-1 last:border-b-0">
            <div
              className="text-meta text-muted-foreground bg-fill-subtle/50 flex items-center justify-between gap-2 px-3 py-1"
              title={path}
            >
              <span className="truncate font-mono">{path}</span>
              <span className="tabular-nums">{matches.length}</span>
            </div>
            {matches.map((match, index) => (
              <button
                key={`${match.line}-${index}`}
                type="button"
                onClick={() => onOpen(match.path, match.line)}
                className="hover:bg-fill-hover focus-visible:bg-fill-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent3/60 flex w-full items-baseline gap-2 px-3 py-0.5 text-left"
              >
                <span className="text-muted-foreground/70 w-8 shrink-0 text-right tabular-nums">{match.line}</span>
                <HighlightedCode code={match.preview} path={match.path} className="truncate font-mono" />
              </button>
            ))}
          </div>
        ))}
        {!query && !search.isFetching && (
          <div className="text-muted-foreground grid h-full place-items-center px-3 py-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search size={20} className="opacity-40" aria-hidden />
              <span>Type at least 2 characters to search.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
