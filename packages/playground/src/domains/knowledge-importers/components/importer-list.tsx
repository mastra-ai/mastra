import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { isConnected } from '../status';
import { ImporterListItem } from './importer-list-item';

export interface ImporterListProps {
  summaries: KnowledgeImporterSummary[];
  selectedId: string;
  onSelect: (importerId: string) => void;
}

/** Connected importers first; the rest wait in a collapsed "Not connected" group with the one-line fix. */
export function ImporterList({ summaries, selectedId, onSelect }: ImporterListProps) {
  const connected = summaries.filter(isConnected);
  const notConnected = summaries.filter(summary => !isConnected(summary));

  return (
    <nav aria-label="Importers" className="flex flex-col gap-4">
      <ul className="flex flex-col gap-0.5">
        {connected.map(summary => (
          <ImporterListItem
            key={summary.importerId}
            summary={summary}
            selected={summary.importerId === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>

      {notConnected.length > 0 ? (
        <Collapsible defaultOpen={notConnected.some(summary => summary.importerId === selectedId)}>
          <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground">
            <ChevronRight className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" aria-hidden />
            <Txt as="span" variant="eyebrow">
              Not connected · {notConnected.length}
            </Txt>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Txt variant="caption" tone="muted" className="px-2.5 pt-1 pb-2">
              Connect these on the Mastra Platform, then link the connection to this project.
            </Txt>
            <ul className="flex flex-col gap-0.5">
              {notConnected.map(summary => (
                <ImporterListItem
                  key={summary.importerId}
                  summary={summary}
                  selected={summary.importerId === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </nav>
  );
}
