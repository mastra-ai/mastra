import { Input } from '@mastra/playground-ui/components/Input';
import { Search } from 'lucide-react';
import { useDeferredValue, useId, useState } from 'react';

import { useKnowledgeSearch } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeSearchResult } from '../../services/knowledge';

interface KnowledgeSearchProps {
  factoryProjectId: string | undefined;
  threadId?: string;
  onSelect: (result: KnowledgeSearchResult) => void;
}

export function KnowledgeSearch({ factoryProjectId, threadId, onSelect }: KnowledgeSearchProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const deferredQuery = useDeferredValue(query);
  const search = useKnowledgeSearch(factoryProjectId, deferredQuery, threadId);
  const results = search.data?.results ?? [];
  const open = focused && query.trim().length >= 2;
  const resultsReady = !search.isPending && !search.isError && deferredQuery === query && results.length > 0;
  const activeResult = resultsReady ? results[activeIndex] : undefined;
  const activateResult = (index: number) => {
    setActiveIndex(index);
    requestAnimationFrame(() => {
      const option = document.getElementById(`${listboxId}-option-${index}`);
      option?.scrollIntoView?.({ block: 'nearest' });
    });
  };
  const selectResult = (result: KnowledgeSearchResult) => {
    onSelect(result);
    setQuery('');
    setActiveIndex(-1);
  };

  return (
    <div className="relative w-full">
      <div className="border-border bg-background flex items-center gap-2 rounded-md border px-2">
        <Search className="text-muted-foreground size-4 shrink-0" />
        <Input
          variant="unstyled"
          role="combobox"
          aria-label="Search knowledge"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={activeResult ? `${listboxId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          className="text-foreground placeholder:text-placeholder h-9 min-w-0 flex-1 p-0"
          placeholder="Search"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={event => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setQuery('');
              setActiveIndex(-1);
              event.currentTarget.blur();
              return;
            }
            if (!open || !resultsReady) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              activateResult(activeIndex < results.length - 1 ? activeIndex + 1 : 0);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              activateResult(activeIndex > 0 ? activeIndex - 1 : results.length - 1);
              return;
            }
            if (event.key === 'Enter' && activeResult) {
              event.preventDefault();
              selectResult(activeResult);
            }
          }}
        />
      </div>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Knowledge search results"
          className="border-border bg-background absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-lg"
          onMouseDown={event => event.preventDefault()}
        >
          {search.isPending || deferredQuery !== query ? (
            <div className="text-muted-foreground px-3 py-2 text-xs">Searching…</div>
          ) : search.isError ? (
            <div className="px-3 py-2 text-xs text-red-400">Unable to search knowledge.</div>
          ) : search.data?.results.length ? (
            <>
              {results.map((result, index) => (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={`${result.type}:${result.id}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  className={[
                    'hover:bg-fill-hover flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left',
                    index === activeIndex ? 'bg-fill' : '',
                  ].join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectResult(result)}
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate text-sm">{result.name}</span>
                    {result.type === 'scope' && result.address ? (
                      <span className="text-muted-foreground block truncate text-xs">{result.address}</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">{result.type === 'scope' ? 'scope' : result.kind}</span>
                </button>
              ))}
              {search.data.truncated ? (
                <div className="text-muted-foreground px-3 py-1.5 text-xs">Keep typing to narrow the results.</div>
              ) : null}
            </>
          ) : (
            <div className="text-muted-foreground px-3 py-2 text-xs">No matching knowledge.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
