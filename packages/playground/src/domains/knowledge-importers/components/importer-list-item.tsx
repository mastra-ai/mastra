import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { importerState } from '../status';
import { ImporterMonogram } from './importer-monogram';
import { ImporterStateBadge } from './importer-state-badge';
import { ImporterStatusLine } from './importer-status-line';

export interface ImporterListItemProps {
  summary: KnowledgeImporterSummary;
  /** The account name, disambiguated against the other entries of the same provider. */
  account: string;
  selected: boolean;
  onSelect: (key: string) => void;
}

export function ImporterListItem({ summary, account, selected, onSelect }: ImporterListItemProps) {
  const state = importerState(summary);
  return (
    <li>
      <button
        type="button"
        data-testid={`importer-row-${summary.key}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(summary.key)}
        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-fill-hover aria-[current=true]:bg-fill-hover"
      >
        <ImporterMonogram label={summary.label} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center justify-between gap-2">
            <Txt as="span" variant="label" className="truncate">
              {summary.label}
            </Txt>
            {state !== 'off' ? <ImporterStateBadge state={state} /> : null}
          </span>
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {account}
          </Txt>
          <ImporterStatusLine summary={summary} />
        </span>
      </button>
    </li>
  );
}
