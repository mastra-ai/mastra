import { Input } from '@mastra/playground-ui/components/Input';
import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

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
  const deferredQuery = useDeferredValue(query);
  const search = useKnowledgeSearch(factoryProjectId, deferredQuery, threadId);
  const open = focused && query.trim().length >= 2;

  return (
    <div className="relative w-full max-w-sm">
      <div className="border-surface5 bg-surface2 flex items-center gap-2 rounded-md border px-2">
        <Search className="text-icon3 size-4 shrink-0" />
        <Input
          variant="unstyled"
          aria-label="Search knowledge"
          autoComplete="off"
          className="text-icon6 placeholder:text-icon3 h-9 min-w-0 flex-1 p-0"
          placeholder="Search"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            setQuery('');
            event.currentTarget.blur();
          }}
        />
      </div>
      {open ? (
        <div
          role="listbox"
          aria-label="Knowledge search results"
          className="border-surface5 bg-surface2 absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-lg"
          onMouseDown={event => event.preventDefault()}
        >
          {search.isPending || deferredQuery !== query ? (
            <div className="text-icon3 px-3 py-2 text-xs">Searching…</div>
          ) : search.isError ? (
            <div className="px-3 py-2 text-xs text-red-400">Unable to search knowledge.</div>
          ) : search.data?.results.length ? (
            <>
              {search.data.results.map(result => (
                <button
                  key={`${result.type}:${result.id}`}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="hover:bg-surface4 flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left"
                  onClick={() => {
                    onSelect(result);
                    setQuery('');
                    setFocused(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="text-icon6 block truncate text-sm">{result.name}</span>
                    {result.type === 'scope' && result.address ? (
                      <span className="text-icon3 block truncate text-xs">{result.address}</span>
                    ) : null}
                  </span>
                  <span className="text-icon3 shrink-0 text-xs">{result.type === 'scope' ? 'scope' : result.kind}</span>
                </button>
              ))}
              {search.data.truncated ? (
                <div className="text-icon3 px-3 py-1.5 text-xs">Keep typing to narrow the results.</div>
              ) : null}
            </>
          ) : (
            <div className="text-icon3 px-3 py-2 text-xs">No matching knowledge.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
