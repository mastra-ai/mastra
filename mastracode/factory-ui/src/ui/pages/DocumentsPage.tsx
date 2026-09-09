import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useFactoryDocuments, useRefreshFactoryDocuments } from '../../hooks/useFactoryDocuments';
import { relativeTime } from '../../lib/date/relativeTime';
import { DocumentInventory } from '../domains/factory/components/documents/DocumentInventory';
import { DocumentReader } from '../domains/factory/components/documents/DocumentReader';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { inventoryByGroup, inventoryRows } from '../domains/factory/services/documents';
import { SkeletonRows } from '../ui/SkeletonRows';

/** How long the inventory polls fast after a refresh before giving up on a newer sync. */
const REFRESH_WATCH_MS = 60_000;

/**
 * The Documents page: the factory's document inventory — the fixed catalog of
 * business and technical documents, each present, missing, or too large in
 * the repository's `docs/factory/` folder — with the selected document
 * rendered beside it. Selection lives in `?doc=<kind>` so a document is
 * linkable. The repository stays the source of truth: the page reads the
 * copy synced on the last run and offers an explicit refresh.
 */
export function DocumentsPage() {
  return <FactoryPageShell>{project => <DocumentsContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

function DocumentsContent({ factoryProjectId }: { factoryProjectId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKind = searchParams.get('doc');
  // After a refresh, poll fast until the sync timestamp moves (or a minute passes).
  const [watchingSince, setWatchingSince] = useState<string | null>(null);
  const watchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const documentsQuery = useFactoryDocuments(factoryProjectId, { refreshing: watchingSince !== null });
  const refresh = useRefreshFactoryDocuments(factoryProjectId);

  const syncedAt = documentsQuery.data?.sync?.syncedAt ?? null;
  useEffect(() => {
    if (watchingSince !== null && syncedAt !== null && syncedAt !== watchingSince) setWatchingSince(null);
  }, [syncedAt, watchingSince]);
  useEffect(() => () => clearTimeout(watchTimer.current), []);

  const groups = useMemo(
    () => (documentsQuery.data ? inventoryByGroup(documentsQuery.data) : null),
    [documentsQuery.data],
  );
  const selectedRow = useMemo(
    () =>
      documentsQuery.data ? (inventoryRows(documentsQuery.data).find(row => row.kind === selectedKind) ?? null) : null,
    [documentsQuery.data, selectedKind],
  );

  const select = (kind: string) => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('doc', kind);
      return copy;
    });
  };

  const onRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => {
        setWatchingSince(syncedAt ?? '');
        clearTimeout(watchTimer.current);
        watchTimer.current = setTimeout(() => setWatchingSince(null), REFRESH_WATCH_MS);
      },
    });
  };

  const refreshing = refresh.isPending || watchingSince !== null;
  const docsRoot = documentsQuery.data?.docsRoot ?? 'docs/factory';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Txt as="h1" variant="header-md" className="text-icon6">
            Documents
          </Txt>
          <Txt as="p" variant="ui-md" className="text-icon3">
            The essential business and technical documents for this factory, kept in{' '}
            <code className="font-mono">{docsRoot}/</code> in the repository and read by every run.
          </Txt>
          <Txt as="p" variant="ui-xs" className="text-icon3">
            {syncedAt
              ? `Synced ${relativeTime(syncedAt)}${
                  documentsQuery.data?.sync?.manifestStatus === 'missing'
                    ? ` · no ${documentsQuery.data.manifestPath} yet, using default paths`
                    : documentsQuery.data?.sync?.manifestStatus === 'invalid'
                      ? ` · ${documentsQuery.data.manifestPath} is invalid, using default paths`
                      : ''
                }`
              : documentsQuery.data
                ? 'Not synced yet. The inventory fills in the first time a run checks out the repository.'
                : ''}
          </Txt>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing || documentsQuery.isPending}
          aria-label={refreshing ? 'Refreshing documents' : 'Refresh documents'}
        >
          <RefreshCw aria-hidden className={refreshing ? 'animate-spin' : undefined} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>

      {documentsQuery.isError ? (
        <Notice variant="destructive">
          {documentsQuery.error instanceof Error ? documentsQuery.error.message : 'Unable to load documents.'}
        </Notice>
      ) : null}
      {refresh.isError ? (
        <Notice variant="warning">
          {refresh.error instanceof Error ? refresh.error.message : 'Unable to refresh documents.'}
        </Notice>
      ) : null}

      {documentsQuery.isPending ? (
        <SkeletonRows label="Loading documents" rows={6} rowClassName="h-10 w-full" />
      ) : groups ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="flex min-h-0 flex-col lg:w-[26rem] lg:shrink-0">
            <DocumentInventory groups={groups} selectedKind={selectedKind} onSelect={select} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <DocumentReader factoryProjectId={factoryProjectId} row={selectedRow} docsRoot={docsRoot} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
