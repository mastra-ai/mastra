import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { GitBranch, GitPullRequest, SquareKanban } from 'lucide-react';
import type { ReactNode } from 'react';

import type { GlobalSearchSelectHandler } from '../services/searchNavigation';
import type { SessionSearchResult } from '../services/searchResults';

function sessionResultIcon(kind: SessionSearchResult['kind']): ReactNode {
  switch (kind) {
    case 'work-session':
      return <SquareKanban />;
    case 'review-session':
      return <GitPullRequest />;
    case 'user-session':
      return <GitBranch />;
  }
}

export function GlobalSearchSessionResults({
  title,
  results,
  onSelect,
}: {
  title: 'Work Sessions' | 'Review Sessions' | 'User Sessions';
  results: SessionSearchResult[];
  onSelect: GlobalSearchSelectHandler;
}) {
  if (results.length === 0) return null;

  return (
    <CommandGroup heading={title}>
      {results.map(result => (
        <CommandPaletteItem
          key={`${result.kind}:${result.id}`}
          icon={sessionResultIcon(result.kind)}
          title={result.title}
          subtitle={result.context}
          badge={result.identifier}
          value={result.value}
          onSelect={() => onSelect(result.path, result.preserveOrigin)}
        />
      ))}
    </CommandGroup>
  );
}
