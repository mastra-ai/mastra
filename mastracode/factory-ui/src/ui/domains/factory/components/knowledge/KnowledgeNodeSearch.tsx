import { Button } from '@mastra/playground-ui/components/Button';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId, useState } from 'react';
import type { KnowledgeGraphNode } from '../../services/knowledge';

export function KnowledgeNodeSearch({
  nodes,
  onSelect,
}: {
  nodes: KnowledgeGraphNode[];
  onSelect: (node: KnowledgeGraphNode) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const term = query.trim().toLocaleLowerCase();
  const matches = nodes.filter(node => node.name.toLocaleLowerCase().includes(term));
  const results = matches.slice(0, 8);
  const showResults = open && term.length > 0;
  const active = results[activeIndex];

  function select(node: KnowledgeGraphNode) {
    setOpen(false);
    onSelect(node);
  }

  return (
    <div
      className="relative"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <SearchInput
        label="Find a node"
        placeholder="Find a node…"
        value={query}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-activedescendant={showResults && active ? `${listId}-${active.id}` : undefined}
        onFocus={() => setOpen(true)}
        onValueChange={value => {
          setQuery(value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setOpen(false);
            event.stopPropagation();
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(index => Math.max(0, Math.min(results.length - 1, index + direction)));
          } else if (event.key === 'Enter' && showResults && active) {
            event.preventDefault();
            select(active);
          }
        }}
      />
      {showResults ? (
        <div className={cn(overlaySurfaceStyle, 'absolute top-full right-0 left-0 z-30 mt-2 rounded-xl p-2')}>
          <div role="listbox" id={listId} aria-label="Matching nodes" className="flex flex-col gap-1">
            {results.map((node, index) => (
              <Button
                key={node.id}
                id={`${listId}-${node.id}`}
                role="option"
                aria-selected={index === activeIndex}
                variant={index === activeIndex ? 'default' : 'ghost'}
                className="w-full justify-start"
                onMouseDown={event => event.preventDefault()}
                onClick={() => select(node)}
              >
                <Txt as="span" variant="label" className="truncate">
                  {node.name}
                </Txt>
              </Button>
            ))}
          </div>
          <Txt as="p" variant="caption" tone="muted" className="m-2" role="status">
            {matches.length === 0 ? 'No matching nodes' : `${matches.length} matching nodes`}
          </Txt>
        </div>
      ) : null}
    </div>
  );
}
