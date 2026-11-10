import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import type { WorkItemSearchResult } from '../services/searchResults';
import { IconTicket } from '@mastra/playground-ui/icons/central/IconTicket';

export function GlobalSearchWorkItemResults({
  results,
  onSelect,
}: {
  results: WorkItemSearchResult[];
  onSelect: (result: WorkItemSearchResult) => void;
}) {
  if (results.length === 0) return null;

  return (
    <CommandGroup heading="Work Items">
      {results.map(result => (
        <CommandPaletteItem
          key={result.id}
          icon={<IconTicket />}
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
          onSelect={() => onSelect(result)}
        />
      ))}
    </CommandGroup>
  );
}
