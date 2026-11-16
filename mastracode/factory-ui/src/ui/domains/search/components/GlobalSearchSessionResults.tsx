import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import type { ReactNode } from 'react';

import type { GlobalSearchSelectHandler } from '../services/searchNavigation';
import type { SessionSearchResult } from '../services/searchResults';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';

function sessionResultIcon(kind: SessionSearchResult['kind']): ReactNode {
  switch (kind) {
    case 'work-session':
      return <IconKanbanView />;
    case 'review-session':
      return <IconPullRequest />;
    case 'user-session':
      return <IconBranch />;
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
          subtitle={
            <Metadata singleLine>
              {result.context.map((part, index) => (
                <Metadata.Item key={index} className={index === 0 ? 'shrink-0' : undefined}>
                  {part}
                </Metadata.Item>
              ))}
            </Metadata>
          }
          badge={result.identifier}
          value={result.value}
          onSelect={() => onSelect(result.path, result.preserveOrigin)}
        />
      ))}
    </CommandGroup>
  );
}
