import { Badge } from '@mastra/playground-ui/components/Badge';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FileText, FileWarning } from 'lucide-react';

import { useFactoryDocument } from '../../../../../hooks/useFactoryDocuments';
import { relativeTime } from '../../../../../lib/date/relativeTime';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import type { FactoryDocumentInventoryRow } from '../../services/documents';
import { RequestError } from '../../services/request';
import { PANEL, TIMESTAMP } from '../panel';
import { DOCUMENT_STATUS_STYLE } from './documentStatus';

interface DocumentReaderProps {
  factoryProjectId: string;
  row: FactoryDocumentInventoryRow | null;
  docsRoot: string;
}

/** The right-hand pane: the selected document rendered, or why there is nothing to render. */
export function DocumentReader({ factoryProjectId, row, docsRoot }: DocumentReaderProps) {
  if (!row) {
    return (
      <EmptyState
        className="min-h-0 flex-1"
        as="h3"
        iconSlot={<FileText className="text-icon3 size-5" aria-hidden />}
        titleSlot="Select a document"
        descriptionSlot={`Pick a document on the left to read it. Documents are synced from ${docsRoot}/ on the default branch.`}
      />
    );
  }
  if (row.status === 'missing') {
    return (
      <EmptyState
        className="min-h-0 flex-1"
        as="h3"
        iconSlot={<FileText className="text-icon3 size-5" aria-hidden />}
        titleSlot={`${row.label} is not in the repository yet`}
        descriptionSlot={
          <span className="flex flex-col gap-2">
            <span>{row.purpose}</span>
            <span>
              Expected at <code className="font-mono">{row.path}</code>. Agents create and update it in the same branch
              as the code change that touches this area; the inventory refreshes when the change lands on the default
              branch.
            </span>
          </span>
        }
      />
    );
  }
  return <DocumentBody factoryProjectId={factoryProjectId} row={row} />;
}

function DocumentBody({ factoryProjectId, row }: { factoryProjectId: string; row: FactoryDocumentInventoryRow }) {
  const documentQuery = useFactoryDocument(factoryProjectId, row.kind);
  const { tone, label } = DOCUMENT_STATUS_STYLE[row.status];

  if (documentQuery.isPending) {
    return <SkeletonRows label={`Loading ${row.label}`} rows={6} rowClassName="h-4 w-full" />;
  }
  if (documentQuery.isError) {
    const gone = documentQuery.error instanceof RequestError && documentQuery.error.status === 404;
    return (
      <Notice variant={gone ? 'info' : 'destructive'}>
        {gone
          ? 'This document is no longer in the index. Refresh the inventory to pick up the latest sync.'
          : documentQuery.error instanceof Error
            ? documentQuery.error.message
            : 'Unable to load the document.'}
      </Notice>
    );
  }

  const document = documentQuery.data.document;
  return (
    <article className={`${PANEL} flex min-h-0 flex-1 flex-col`} aria-label={document.title ?? row.label}>
      <header className="border-border1 flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Txt as="h2" variant="ui-md" className="text-icon6 min-w-0 truncate font-medium">
          {document.title ?? row.label}
        </Txt>
        <Badge size="xs" variant={tone} emphasis="muted">
          {label}
        </Badge>
        <Txt as="span" variant="ui-xs" className="text-icon3 min-w-0 truncate font-mono" title={document.path}>
          {document.path}
        </Txt>
        <span className={`${TIMESTAMP} ml-auto`}>
          synced {relativeTime(document.syncedAt)}
          {document.sourceSha ? ` · ${document.sourceRef}@${document.sourceSha.slice(0, 7)}` : ''}
        </span>
      </header>
      {document.status === 'oversize' || document.content === null ? (
        <div className="p-4">
          <Notice variant="warning">
            <span className="flex items-center gap-2">
              <FileWarning size={14} aria-hidden />
              This document is too large to store in the index
              {document.sizeBytes ? ` (${Math.round(document.sizeBytes / 1024)} KiB)` : ''}. Read it from the
              repository.
            </span>
          </Notice>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1" revealScrollbarOnHover={false}>
          <div className="px-4 py-3">
            <MarkdownRenderer className="text-ui-sm text-icon4">{document.content}</MarkdownRenderer>
          </div>
        </ScrollArea>
      )}
    </article>
  );
}
