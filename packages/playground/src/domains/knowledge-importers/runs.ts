import type { KnowledgeImporterRunSummary } from '@mastra/client-js';

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
