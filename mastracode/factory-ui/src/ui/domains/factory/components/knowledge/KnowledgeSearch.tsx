import { Button } from '@mastra/playground-ui/components/Button';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';

import type { KnowledgeGraphNode } from '../../services/knowledge';
import { knowledgeScopes } from './knowledgeScope';

/** Keep typing local so a dense graph does not re-render on every keystroke. */
export function KnowledgeSearch({
  nodes,
  onSelect,
}: {
  nodes: KnowledgeGraphNode[];
  onSelect: (node: KnowledgeGraphNode) => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const matches = query
    ? nodes.filter(node => `${node.name} ${node.kind}`.toLowerCase().includes(query)).slice(0, 7)
    : [];
  const select = (node: KnowledgeGraphNode) => {
    onSelect(node);
    setSearch('');
  };

  return (
    <div className="relative min-w-48 flex-1 md:max-w-72">
      <SearchInput
        label="Find knowledge"
        placeholder="Find a node…"
        size="sm"
        value={search}
        onValueChange={setSearch}
        onKeyDown={event => {
          if (event.key === 'Escape') setSearch('');
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            select(matches[0]);
          }
        }}
      />
      {query ? (
        <div
          className={cn(overlaySurfaceStyle, 'absolute top-full left-0 z-30 mt-2 w-full rounded-xl p-2')}
          aria-label="Knowledge search results"
        >
          {matches.map(node => (
            <Button
              key={node.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => select(node)}
              icon={<span className={cn('block size-2 rounded-full', knowledgeScopes[node.rung].dot)} />}
            >
              <span className="truncate">{node.name}</span>
            </Button>
          ))}
          {matches.length === 0 ? (
            <Txt variant="caption" tone="muted" className="p-2" role="status">
              No matching nodes.
            </Txt>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
