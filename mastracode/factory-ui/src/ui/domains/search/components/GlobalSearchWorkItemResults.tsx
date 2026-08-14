import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Ticket } from 'lucide-react';

import type { WorkItemSearchResult } from '../services/searchResults';

export function GlobalSearchWorkItemResults({
  results,
  loadingFor,
  onSelect,
}: {
  results: WorkItemSearchResult[];
  loadingFor: (result: WorkItemSearchResult) => string | undefined;
  onSelect: (result: WorkItemSearchResult) => void;
}) {
  if (results.length === 0) return null;

  return (
    <CommandGroup heading="Work Items">
      {results.map(result => {
        const loading = loadingFor(result);
        return (
          <CommandPaletteItem
            key={result.id}
            icon={loading ? <Spinner size="sm" /> : <Ticket />}
            title={result.title}
            subtitle={loading ?? result.context}
            badge={result.identifier}
            value={result.value}
            disabled={loading !== undefined}
            onSelect={() => onSelect(result)}
          />
        );
      })}
    </CommandGroup>
  );
}
