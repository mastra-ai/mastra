import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useFactoryMetrics } from '../../hooks/useFactoryMetrics';
import { useQueueHealth } from '../../hooks/useQueueHealth';
import { useRunningSessions } from '../../hooks/useWorkItems';
import { formatDuration } from '../../lib/date/formatDuration';
import { attentionRows } from '../domains/factory/attention';
import { AttentionSection } from '../domains/factory/components/AttentionSection';
import { Chip, ChipRow } from '../domains/factory/components/Chips';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { FunnelChart } from '../domains/factory/components/FunnelChart';
import { KpiStrip } from '../domains/factory/components/KpiStrip';
import { QueueHealthPanel } from '../domains/factory/components/QueueHealthPanel';
import { Section } from '../domains/factory/components/Section';
import { Stat } from '../domains/factory/components/Stat';
import { reviewFunnel, workFunnel } from '../domains/factory/funnel-source';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { DEFAULT_RANGE_DAYS, useMetricsWindow } from '../domains/factory/window';

// all inside the server's 366-day aggregation cap
const RANGE_PRESETS = [
  { days: 7, short: '7d', label: 'Last 7 days' },
  { days: 30, short: '30d', label: 'Last 30 days' },
  { days: 90, short: '90d', label: 'Last 90 days' },
  { days: 365, short: '12m', label: 'Last 12 months' },
];

const STATS = 'm-0 grid auto-rows-fr grid-cols-2 gap-3';

export function OverviewPage() {
  return (
    <DocumentFactoryPageShell>{project => <OverviewContent factoryProjectId={project.id} />}</DocumentFactoryPageShell>
  );
}

/** Delivery over the window the switch names, then the board as it stands now. */
function OverviewContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const range = useMetricsWindow(rangeDays);
  const metricsQuery = useFactoryMetrics(factoryProjectId, range);
  const queue = useQueueHealth(factoryProjectId);
  const agentsRunning = useRunningSessions(factoryProjectId).size;

  if (metricsQuery.isError) {
    const message = metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load metrics';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const metrics = metricsQuery.data;
  if (!metrics) return <OverviewLoading />;

  const worked = workBoardMoved(metrics);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 pb-20">
      <h1 className="sr-only">Overview</h1>

      <Section label="Delivered" action={<RangeSwitch rangeDays={rangeDays} onSelect={setRangeDays} />}>
        {worked ? <KpiStrip metrics={metrics} /> : <Quiet>No card was pulled in or shipped in this window.</Quiet>}
      </Section>

      {worked ? (
        <section aria-label="Where work stops">
          <FunnelChart
            source={workFunnel(metrics.funnel, metrics.agentCoverage, metrics.stageDwell)}
            label="Where work stops, from the first triage to shipped"
          />
        </section>
      ) : null}

      {reviewBoardUsed(metrics.review) ? (
        <Section label="Review threads">
          <ReviewFlow review={metrics.review} />
        </Section>
      ) : null}

      {queue.isPending ? (
        <Skeleton className="h-56 w-full rounded-lg" />
      ) : (
        <>
          <AttentionSection rows={attentionRows(queue.health)} />

          <Section label="Right now">
            <div className="flex flex-col gap-12">
              <dl className={`${STATS} sm:grid-cols-3`}>
                <Stat label="Waiting to start" value={String(queue.health.waiting)} />
                <Stat label="In flight" value={String(queue.health.inFlight)} />
                <Stat label="Agents running" value={String(agentsRunning)} />
              </dl>
              <QueueHealthPanel {...queue} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Quiet({ children }: { children: string }) {
  return (
    <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
      {children}
    </Txt>
  );
}

/** Five zeros and three em dashes say "nothing happened" five times over. */
function workBoardMoved({ funnel, leadTime }: FactoryMetrics): boolean {
  return (funnel.gates[0]?.reached ?? 0) > 0 || leadTime.samples > 0;
}

function reviewBoardUsed({ intake, completed }: FactoryMetrics['review']): boolean {
  return intake.arrived + intake.waiting + completed > 0;
}

/**
 * The review board keeps its own row of figures. Reviewing a pull request takes
 * minutes where building a card takes days, so the two never share a median.
 */
function ReviewFlow({ review }: { review: FactoryMetrics['review'] }) {
  const { medianMs, p90Ms } = review.leadTime;
  return (
    <div className="flex flex-col gap-12">
      <FunnelChart source={reviewFunnel(review)} label="Review threads, from filed to reviewed" />
      <dl className={STATS}>
        <Stat
          label="Time to review"
          value={medianMs === null ? '—' : formatDuration(medianMs)}
          detail={p90Ms === null ? undefined : `p90 ${formatDuration(p90Ms)}`}
        />
        <Stat label="Waiting on a review" value={String(review.intake.waiting)} />
      </dl>
    </div>
  );
}

function RangeSwitch({ rangeDays, onSelect }: { rangeDays: number; onSelect: (days: number) => void }) {
  return (
    <ChipRow label="Date range">
      {RANGE_PRESETS.map(preset => (
        <Chip
          key={preset.days}
          active={preset.days === rangeDays}
          onClick={() => onSelect(preset.days)}
          className="font-mono tabular-nums"
        >
          <span className="sr-only">{preset.label}</span>
          <span aria-hidden="true">{preset.short}</span>
        </Chip>
      ))}
    </ChipRow>
  );
}

function OverviewLoading() {
  return (
    <div
      role="status"
      aria-label="Loading factory overview"
      className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 lg:grid-cols-5"
    >
      <Skeleton className="h-40 w-full rounded-xl lg:col-span-2" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="col-span-2 mt-11 h-56 w-full rounded-lg lg:col-span-5" />
    </div>
  );
}
