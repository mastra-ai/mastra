import type { KnowledgeImporterPreviewDestination, KnowledgeImporterRunSummary } from '@mastra/client-js';

export const RUN_KIND_LABEL: Record<KnowledgeImporterRunSummary['kind'], string> = {
  'dry-run': 'Dry run',
  run: 'Run',
  scheduled: 'Scheduled',
  webhook: 'Webhook',
};

const COUNT_LABELS: [keyof NonNullable<KnowledgeImporterRunSummary['counts']>, string][] = [
  ['nodesCreated', 'created'],
  ['nodesUpdated', 'updated'],
  ['nodesRemoved', 'removed'],
  ['recordsWritten', 'records'],
  ['skipped', 'skipped'],
];

export function describeCounts(counts: KnowledgeImporterRunSummary['counts']): string {
  if (!counts) return '—';
  const parts = COUNT_LABELS.flatMap(([key, label]) => {
    const value = counts[key];
    return typeof value === 'number' ? [`${value} ${label}`] : [];
  });
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function describeDuration(run: KnowledgeImporterRunSummary): string {
  if (!run.startedAt || !run.completedAt) return '—';
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Placement only — importers never read provider ACLs, so this copy must not claim who can read. */
export function describePlacement(destination: KnowledgeImporterPreviewDestination): string {
  return destination.placement === 'org-wide' ? 'Org-wide area' : `Own container: ${destination.label}`;
}

const KNOWN_SKIP_REASONS: Record<string, string> = {
  'slack-private-conversation': 'Private Slack channels are never imported',
};

/** Plain-English skip reason: the server's label, a known code, or the code made readable. */
export function describeSkipReason(entry: { reason: string; label?: string }): string {
  if (entry.label) return entry.label;
  const known = KNOWN_SKIP_REASONS[entry.reason];
  if (known) return known;
  const words = entry.reason.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** Pages a run created or refreshed. */
export function pagesTouched(run: KnowledgeImporterRunSummary): number | undefined {
  if (!run.counts) return undefined;
  return (run.counts.nodesCreated ?? 0) + (run.counts.nodesUpdated ?? 0);
}

export const describePages = (count: number) => plural(count, 'page');

/** One sentence for what a settled run did (or, for a preview, would do). */
export function describeOutcome(run: KnowledgeImporterRunSummary): string {
  if (run.status === 'failed') return run.error ?? 'Failed without an error message.';
  if (!run.counts) return run.kind === 'dry-run' ? 'Preview finished.' : 'Finished.';
  const pages = describePages(pagesTouched(run) ?? 0);
  const records = plural(run.counts.recordsWritten ?? 0, 'record');
  const skipped = run.counts.skipped ? ` · ${plural(run.counts.skipped, 'item')} skipped` : '';
  const removed = run.counts.nodesRemoved ? ` · ${plural(run.counts.nodesRemoved, 'page')} removed` : '';
  return run.kind === 'dry-run'
    ? `Would import ${pages} and ${records}${removed}${skipped}`
    : `Imported ${pages} and ${records}${removed}${skipped}`;
}

/** When the run finished, or started if it hasn't. */
export const runTime = (run: KnowledgeImporterRunSummary) => run.completedAt ?? run.startedAt ?? undefined;
