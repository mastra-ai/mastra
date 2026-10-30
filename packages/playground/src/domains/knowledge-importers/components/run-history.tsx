import type { KnowledgeImporterRunSummary } from '@mastra/client-js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { RUN_KIND_LABEL, describeDuration, describeOutcome, runTime } from '../runs';
import { readApiError } from '../settings';
import { isRunActive, useImporterRuns } from '../use-knowledge-importers';
import { RunReport } from './run-report';
import { RunStatusBadge } from './status-badges';

const SKELETON_ROWS = [0, 1, 2];

export function RunHistory({ importerId }: { importerId: string }) {
  const runs = useImporterRuns(importerId);

  if (runs.isPending) {
    return (
      <div role="status" aria-label="Loading activity" className="flex flex-col gap-3">
        {SKELETON_ROWS.map(row => (
          <SkeletonText key={row} />
        ))}
      </div>
    );
  }
  if (runs.isError) {
    return (
      <Notice variant="destructive" title="Couldn't load activity">
        <Notice.Message>{readApiError(runs.error).message}</Notice.Message>
      </Notice>
    );
  }
  if (runs.data.length === 0) {
    return (
      <Txt variant="body-sm" tone="muted">
        No runs yet.
      </Txt>
    );
  }
  return (
    <ul aria-label="Activity" className="flex flex-col divide-y divide-border">
      {runs.data.map(run => (
        <RunHistoryItem key={run.id} run={run} />
      ))}
    </ul>
  );
}

function RunHistoryItem({ run }: { run: KnowledgeImporterRunSummary }) {
  const when = runTime(run);
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger
          disabled={isRunActive(run)}
          className="group flex w-full items-center gap-3 py-2.5 text-left hover:bg-fill-subtle"
        >
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
          />
          <span className="flex w-28 shrink-0 flex-col">
            <Txt as="span" variant="label">
              {RUN_KIND_LABEL[run.kind]}
            </Txt>
            <Txt as="span" variant="caption" tone="muted">
              {when ? <RelativeTimestamp value={when} /> : 'Not started'}
            </Txt>
          </span>
          <RunStatusBadge status={run.status} />
          <Txt as="span" variant="body-sm" tone="muted" className="min-w-0 flex-1 truncate">
            {isRunActive(run) ? 'In progress…' : describeOutcome(run)}
          </Txt>
          <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums">
            {describeDuration(run)}
          </Txt>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-1 pb-4 pl-6.5">
            <RunReport run={run} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
