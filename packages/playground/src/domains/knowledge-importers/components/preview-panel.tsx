import type { KnowledgeImporterRunSummary } from '@mastra/client-js';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { runTime } from '../runs';
import { isRunActive } from '../use-knowledge-importers';
import { ElapsedTime } from './elapsed-time';
import { RunReport } from './run-report';

export interface PreviewPanelProps {
  /** The run this session started; undefined until its first poll lands. */
  run: KnowledgeImporterRunSummary | undefined;
  /** True once this session started a run (even before the first poll). */
  started: boolean;
  lastPreview: KnowledgeImporterRunSummary | undefined;
}

export function PreviewPanel({ run, started, lastPreview }: PreviewPanelProps) {
  if (started && (!run || isRunActive(run))) return <RunInProgress run={run} />;
  if (run) return <RunReport run={run} />;
  if (lastPreview) {
    const when = runTime(lastPreview);
    return (
      <div className="flex flex-col gap-3">
        <Txt variant="caption" tone="muted">
          Last preview {when ? <RelativeTimestamp value={when} /> : null}
        </Txt>
        <RunReport run={lastPreview} />
      </div>
    );
  }
  return (
    <Txt variant="body-sm" tone="muted">
      Preview shows what an import would bring in and where each part lands. Nothing is written.
    </Txt>
  );
}

function RunInProgress({ run }: { run: KnowledgeImporterRunSummary | undefined }) {
  const importing = run?.kind === 'run';
  return (
    <div role="status" className="flex items-center gap-3" data-testid="run-in-progress">
      <Spinner size="sm" />
      <Txt as="span" variant="body-sm">
        {importing ? 'Importing' : 'Previewing'}
        {run?.status === 'queued' ? ' — waiting to start' : '…'}
      </Txt>
      <Txt as="span" variant="caption" tone="muted">
        <ElapsedTime since={run?.startedAt ?? undefined} />
      </Txt>
    </div>
  );
}
