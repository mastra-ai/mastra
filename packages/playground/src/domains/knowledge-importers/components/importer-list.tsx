import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { accountLabel } from '../connection-name';
import { ConnectorLink } from './connector-link';
import { ImporterListItem } from './importer-list-item';

export interface ImporterListProps {
  summaries: KnowledgeImporterSummary[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

/** One entry per connection linked to this project, then the way to link more. */
export function ImporterList({ summaries, selectedKey, onSelect }: ImporterListProps) {
  return (
    <nav aria-label="Importers" className="flex flex-col gap-4">
      <ul className="flex flex-col gap-0.5">
        {summaries.map(summary => (
          <ImporterListItem
            key={summary.key}
            summary={summary}
            account={accountLabel(summary, summaries)}
            selected={summary.key === selectedKey}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <div className="px-2.5">
        <ConnectorLink />
      </div>
    </nav>
  );
}
