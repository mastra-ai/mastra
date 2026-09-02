import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useKnowledgeImporters,
  useKnowledgeImportRun,
  useKnowledgeImportRuns,
} from '../../../../../hooks/useKnowledgeImports';
import type {
  KnowledgeImporterSummary,
  KnowledgeImportRun,
  KnowledgeImportStatus,
  KnowledgeImportTrigger,
} from '../../services/knowledge-imports';
import { SkeletonRows } from '../../../../ui/SkeletonRows';

function elapsed(run: KnowledgeImportRun): string {
  if (!run.startedAt) return 'Not started';
  const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const milliseconds = Math.max(0, end - new Date(run.startedAt).getTime());
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)}s`;
}

function selectedStatus(value: string): KnowledgeImportStatus | undefined {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'skipped' ||
    value === 'interrupted'
  ) {
    return value;
  }
  return undefined;
}

function selectedTrigger(value: string): KnowledgeImportTrigger | undefined {
  if (value === 'programmatic' || value === 'cron' || value === 'webhook') return value;
  return undefined;
}

function ImportRunDetail({
  factoryProjectId,
  importerId,
  runId,
  threadId,
  onClose,
}: {
  factoryProjectId: string;
  importerId: string;
  runId: string;
  threadId?: string;
  onClose: () => void;
}) {
  const detail = useKnowledgeImportRun(factoryProjectId, importerId, runId, threadId);
  if (detail.isPending) return <SkeletonRows label="Loading import run" rows={5} />;
  if (detail.isError) return <Notice variant="destructive">{detail.error.message}</Notice>;

  const run = detail.data.pages[0]!.run;
  const activity = detail.data.pages.flatMap(page => page.activity);
  return (
    <section
      aria-label="Import run detail"
      className="border-surface5 bg-surface2 flex min-h-0 flex-col gap-4 rounded-lg border p-4"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Txt as="h3" variant="ui-lg" className="text-icon6 font-semibold">
              {run.importerId}
            </Txt>
            <Badge size="xs">{run.status}</Badge>
          </div>
          <Txt as="p" variant="ui-sm" className="text-icon3 mt-1">
            {run.source ?? 'Private source'} · {run.triggerKind} · {elapsed(run)}
          </Txt>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      {run.error ? <Notice variant="destructive">{run.error}</Notice> : null}

      <div>
        <Txt as="h4" variant="ui-sm" className="text-icon5 mb-2 font-semibold">
          Knowledge activity
        </Txt>
        {activity.length === 0 ? (
          <Txt as="p" variant="ui-sm" className="text-icon3">
            This run did not produce visible knowledge changes.
          </Txt>
        ) : (
          <ol className="divide-surface5 divide-y">
            {activity.map(event => (
              <li key={event.id} className="flex justify-between gap-4 py-2 text-sm">
                <span className="text-icon5">
                  {event.action} {event.targetType}
                </span>
                <time className="text-icon3 text-xs" dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
            {detail.hasNextPage ? (
              <li className="flex justify-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={detail.isFetchingNextPage}
                  onClick={() => void detail.fetchNextPage()}
                >
                  {detail.isFetchingNextPage ? 'Loading activity…' : 'Load more activity'}
                </Button>
              </li>
            ) : null}
          </ol>
        )}
      </div>
    </section>
  );
}

function ImportRuns({
  factoryProjectId,
  importer,
  threadId,
  initialRunId,
}: {
  factoryProjectId: string;
  importer: KnowledgeImporterSummary;
  threadId?: string;
  initialRunId?: string;
}) {
  const [binding, setBinding] = useState<string>();
  const [status, setStatus] = useState<KnowledgeImportStatus>();
  const [trigger, setTrigger] = useState<KnowledgeImportTrigger>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(initialRunId);
  const runs = useKnowledgeImportRuns(
    factoryProjectId,
    importer.id,
    {
      binding,
      status,
      trigger,
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    },
    threadId,
  );
  const items = runs.data?.pages.flatMap(page => page.runs) ?? [];

  if (selectedRunId) {
    return (
      <ImportRunDetail
        factoryProjectId={factoryProjectId}
        importerId={importer.id}
        runId={selectedRunId}
        threadId={threadId}
        onClose={() => setSelectedRunId(undefined)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Import run filters">
        <Select value={binding ?? 'all'} onValueChange={value => setBinding(value === 'all' ? undefined : value)}>
          <SelectTrigger size="sm" aria-label="Run binding" className="w-56">
            {binding ?? 'All bindings'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bindings</SelectItem>
            {importer.bindings.map(value => (
              <SelectItem key={value.binding} value={value.binding}>
                {value.source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status ?? 'all'} onValueChange={value => setStatus(selectedStatus(value))}>
          <SelectTrigger size="sm" aria-label="Run status" className="w-36">
            {status ?? 'All statuses'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(['queued', 'running', 'succeeded', 'failed', 'skipped', 'interrupted'] as const).map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={trigger ?? 'all'} onValueChange={value => setTrigger(selectedTrigger(value))}>
          <SelectTrigger size="sm" aria-label="Run trigger" className="w-40">
            {trigger ?? 'All triggers'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All triggers</SelectItem>
            {(['programmatic', 'cron', 'webhook'] as const).map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input aria-label="Runs from date" type="date" value={from} onChange={event => setFrom(event.target.value)} />
        <Input aria-label="Runs through date" type="date" value={to} onChange={event => setTo(event.target.value)} />
      </div>

      {runs.isPending ? <SkeletonRows label="Loading import runs" rows={6} /> : null}
      {runs.isError ? <Notice variant="destructive">{runs.error.message}</Notice> : null}
      {runs.data && items.length === 0 ? (
        <Txt as="p" variant="ui-md" className="text-icon3">
          No import runs match these filters.
        </Txt>
      ) : null}
      {items.length > 0 ? (
        <ol aria-label="Import runs" className="divide-surface5 divide-y">
          {items.map(run => (
            <li key={run.id}>
              <button
                type="button"
                className="hover:bg-surface3 flex w-full items-start justify-between gap-4 px-2 py-3 text-left"
                onClick={() => setSelectedRunId(run.reference)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-icon5 font-medium">{run.source ?? run.binding}</span>
                    <Badge size="xs">{run.status}</Badge>
                  </div>
                  <span className="text-icon3 mt-1 block truncate text-xs">
                    {run.triggerKind} · {elapsed(run)}
                  </span>
                  {run.error ? <span className="text-icon3 mt-1 block truncate text-xs">{run.error}</span> : null}
                </div>
                <time className="text-icon3 shrink-0 text-xs" dateTime={run.queuedAt}>
                  {new Date(run.queuedAt).toLocaleString()}
                </time>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {runs.hasNextPage ? (
        <Button variant="ghost" size="sm" disabled={runs.isFetchingNextPage} onClick={() => void runs.fetchNextPage()}>
          {runs.isFetchingNextPage ? 'Loading…' : 'Load more runs'}
        </Button>
      ) : null}
    </div>
  );
}

export function KnowledgeImports({
  factoryProjectId,
  threadId,
  initialImporterId,
  initialRunId,
}: {
  factoryProjectId: string | undefined;
  threadId?: string;
  initialImporterId?: string;
  initialRunId?: string;
}) {
  const importers = useKnowledgeImporters(factoryProjectId, threadId);
  const [requestedImporterId, setRequestedImporterId] = useState<string | undefined>(initialImporterId);
  if (!factoryProjectId) return null;
  if (importers.isPending) return <SkeletonRows label="Loading knowledge importers" rows={5} />;
  if (importers.isError) return <Notice variant="destructive">{importers.error.message}</Notice>;
  if (importers.data.importers.length === 0) {
    return (
      <Txt as="p" variant="ui-md" className="text-icon3">
        No knowledge importers are registered.
      </Txt>
    );
  }

  const importer =
    importers.data.importers.find(entry => entry.id === requestedImporterId) ?? importers.data.importers.at(0);
  if (!importer) return null;
  return (
    <section className="flex min-h-0 flex-col gap-4" aria-label="Knowledge imports">
      <div className="flex items-center gap-3">
        <Select value={importer.id} onValueChange={setRequestedImporterId}>
          <SelectTrigger size="sm" aria-label="Knowledge importer" className="w-64">
            {importer.id}
          </SelectTrigger>
          <SelectContent>
            {importers.data.importers.map(entry => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge size="xs">{importer.importKind}</Badge>
      </div>
      <ImportRuns
        key={importer.id}
        factoryProjectId={factoryProjectId}
        importer={importer}
        threadId={threadId}
        initialRunId={importer.id === initialImporterId ? initialRunId : undefined}
      />
    </section>
  );
}
