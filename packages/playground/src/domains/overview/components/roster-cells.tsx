import { DataList } from '@mastra/playground-ui/components/DataList';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatCount, formatDuration, formatPercent } from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import type { ReactNode } from 'react';
import { formatLastRun, periodLabels } from '../overview-period';
import type { OverviewRange } from '../overview-period';
import { errorRateOf } from '../run-activity';
import type { RunActivity } from '../run-activity';
import type { Latency } from '../use-root-run-latency';
import { RunStrip } from './run-strip';
import { cn } from '@/lib/utils';

export type LatencyStatus = 'pending' | 'error' | 'success';

export function RosterNameCell({ name, meta, isIdle }: { name: string; meta: ReactNode; isIdle: boolean }) {
  return (
    <DataList.Cell className="py-2">
      <span className="flex min-w-0 flex-col gap-0.5">
        <Txt as="span" variant="label" tone={isIdle ? 'muted' : 'ink'} className="truncate">
          {name}
        </Txt>
        <Txt as="span" variant="meta" tone={isIdle ? 'faint' : 'muted'} className="truncate">
          {meta}
        </Txt>
      </span>
    </DataList.Cell>
  );
}

export function RosterRunsCell({
  name,
  activity,
  range,
  errorNoun,
}: {
  name: string;
  activity: RunActivity;
  range: OverviewRange;
  errorNoun: string;
}) {
  return (
    <DataList.Cell>
      <span className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
        <RunStrip
          runsPerBucket={activity.runsPerBucket}
          errorsPerBucket={activity.errorsPerBucket}
          label={`${name}: ${activity.runs} runs, ${activity.errors} ${errorNoun} over the ${periodLabels[range]}`}
        />
        <span className={cn('text-right tabular-nums', activity.runs > 0 && 'text-foreground')}>
          {formatCount(activity.runs)}
        </span>
      </span>
    </DataList.Cell>
  );
}

export function RosterErrorRateCell({ activity }: { activity: RunActivity }) {
  const rate = errorRateOf(activity.runs, activity.errors);
  return (
    <DataList.NumberCell className={cn(activity.errors > 0 && 'text-destructive-foreground')}>
      {rate === null ? '' : formatPercent(rate)}
    </DataList.NumberCell>
  );
}

export function RosterLatencyCell({ latency, status }: { latency?: Latency; status: LatencyStatus }) {
  if (status === 'pending') {
    return (
      <DataList.NumberCell>
        <Skeleton className="h-4 w-10" />
      </DataList.NumberCell>
    );
  }
  return <DataList.NumberCell>{latency?.p95 == null ? '' : formatDuration(latency.p95)}</DataList.NumberCell>;
}

export function RosterLastRunCell({
  activity,
  range,
  nowMs,
}: {
  activity: RunActivity;
  range: OverviewRange;
  nowMs: number;
}) {
  return (
    <DataList.TextCell>
      {activity.lastRunBucketMs === null
        ? `No runs in ${periodLabels[range]}`
        : formatLastRun(activity.lastRunBucketMs, range, nowMs)}
    </DataList.TextCell>
  );
}
