import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { importerState, isConnected } from '../status';
import { ImporterMonogram } from './importer-monogram';
import { ImporterStateBadge } from './importer-state-badge';

export interface ImporterHeaderProps {
  summary: KnowledgeImporterSummary;
  accountName?: string;
  actions?: ReactNode;
  /** Trailing controls on the saved-by line, e.g. "Reset to defaults". */
  meta?: ReactNode;
}

export function ImporterHeader({ summary, accountName, actions, meta }: ImporterHeaderProps) {
  const { settings } = summary;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <ImporterMonogram label={summary.label} size="lg" />
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Txt as="h2" variant="heading" id="importer-detail-title">
              {summary.label}
            </Txt>
            {isConnected(summary) ? <ImporterStateBadge state={importerState(summary)} /> : null}
          </div>
          {summary.description ? (
            <Txt variant="body-sm" tone="muted">
              {summary.description}
            </Txt>
          ) : null}
          <Txt variant="caption" tone="muted">
            {isConnected(summary) ? (accountName ? `Connected to ${accountName}` : 'Connected') : 'Not connected'}
            {' · '}
            {settings.source === 'saved' ? (
              <>
                Saved{settings.updatedBy ? ` by ${settings.updatedBy}` : ''}{' '}
                {settings.updatedAt ? <RelativeTimestamp value={settings.updatedAt} /> : null}
              </>
            ) : (
              'Using environment defaults'
            )}
            {meta}
          </Txt>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
