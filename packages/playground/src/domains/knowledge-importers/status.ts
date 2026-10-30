import type { KnowledgeImporterSummary } from '@mastra/client-js';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { isRunActive } from './use-knowledge-importers';

/** The one state pill per importer. Connection trouble and failed runs both read as "Needs attention". */
export type ImporterState = 'off' | 'scheduled' | 'running' | 'attention';

export const IMPORTER_STATE: Record<ImporterState, { label: string; variant: BadgeVariant }> = {
  off: { label: 'Off', variant: 'neutral' },
  scheduled: { label: 'Scheduled', variant: 'success' },
  running: { label: 'Running', variant: 'info' },
  attention: { label: 'Needs attention', variant: 'warning' },
};

/** Why the importer needs attention, in one short phrase; undefined when it doesn't. */
export function attentionReason(summary: KnowledgeImporterSummary): string | undefined {
  switch (summary.connection.status) {
    case 'needs_reauth':
      return 'Connection needs re-auth';
    case 'error':
      return 'Connection error';
    default:
      return summary.lastRun?.status === 'failed' ? 'Last run failed' : undefined;
  }
}

export function importerState(summary: KnowledgeImporterSummary): ImporterState {
  if (isRunActive(summary.lastRun ?? undefined)) return 'running';
  if (attentionReason(summary)) return 'attention';
  return summary.settings.enabled && summary.effectiveSchedule !== null ? 'scheduled' : 'off';
}
