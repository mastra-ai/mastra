import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { describePages, pagesTouched } from '../runs';
import { shortSchedule } from '../schedule';
import { attentionReason, importerState, isConnected } from '../status';

/** "Every 15 min · last run 3m ago · 107 pages", "Not set up", "Choose a connection", … */
export function ImporterStatusLine({ summary }: { summary: KnowledgeImporterSummary }) {
  return (
    <Txt as="span" variant="caption" tone="muted" className="truncate">
      <StatusWords summary={summary} />
    </Txt>
  );
}

function StatusWords({ summary }: { summary: KnowledgeImporterSummary }) {
  if (!isConnected(summary)) return 'Not connected to this project';
  const state = importerState(summary);
  const run = summary.lastRun;
  if (state === 'running') return run?.kind === 'dry-run' ? 'Previewing now…' : 'Importing now…';
  const reason = attentionReason(summary);
  const lead =
    reason ?? (state === 'scheduled' && summary.effectiveSchedule ? shortSchedule(summary.effectiveSchedule) : 'Off');
  if (!run) return reason ?? (state === 'scheduled' ? lead : 'Not set up');

  const pages = run.kind === 'dry-run' || run.status === 'failed' ? undefined : pagesTouched(run);
  const when = run.completedAt ?? run.startedAt;
  return (
    <>
      {lead} · {run.kind === 'dry-run' ? 'previewed' : 'last run'}{' '}
      {when ? <RelativeTimestamp value={when} /> : 'just now'}
      {pages === undefined ? null : ` · ${describePages(pages)}`}
    </>
  );
}
