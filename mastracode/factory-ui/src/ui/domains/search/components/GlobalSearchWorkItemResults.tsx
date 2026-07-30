import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Ticket } from 'lucide-react';

import type { GlobalSearchSelectHandler } from '../services/searchNavigation';
import type { WorkItemSearchResult } from '../services/searchResults';

export function GlobalSearchWorkItemResults({
  results,
  onSelect,
}: {
  results: WorkItemSearchResult[];
  onSelect: GlobalSearchSelectHandler;
}) {
  if (results.length === 0) return null;

  return (
    <CommandGroup heading="Work Items">
      {results.map(result => (
        <CommandPaletteItem
          key={result.id}
          icon={<Ticket />}
          title={result.title}
          subtitle={result.context}
          badge={result.identifier}
          value={result.value}
          onSelect={() => onSelect(result.path, false)}
        />
      ))}
    </CommandGroup>
  );
}
