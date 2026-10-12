import { EntityType } from '@mastra/core/observability';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatCount, formatUsd } from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import {
  useAgentRunsKpiMetrics,
  useMetricsQueryFilters,
  useModelCostKpiMetrics,
  useTokenUsageTimeSeries,
  useTotalTokensKpiMetrics,
} from '@mastra/react/hooks/metrics';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useMatch } from 'react-router';
import { hourlyBuckets, useAgentsHourlyRuns } from '../hooks/use-agents-hourly-runs';
import { ActivitySparkline } from './agents-overview/activity-sparkline';
import { useRunMetricsAvailability } from '@/domains/overview/use-run-metrics-availability';
import { cn } from '@/lib/utils';

const agentRunsFilter = { entityType: EntityType.AGENT };
const HOURS_SHOWN = 24;

export function AgentsMetricsCard() {
  const { isChecking, showsActivity } = useRunMetricsAvailability();
  const { Link } = useLinkComponent();
  const isOpen = Boolean(useMatch('/agents'));
  return (
    <Link
      href="/agents"
      aria-current={isOpen ? 'page' : undefined}
      className="group mx-2 mt-1 flex shrink-0 flex-col gap-3 rounded-lg px-2 py-2 transition-colors duration-normal ease-out-custom hover:bg-fill-subtle aria-[current=page]:bg-fill-subtle motion-reduce:transition-none"
    >
      <span className="flex items-center gap-2">
        <Txt as="span" variant="label" tone="ink">
          Overview
        </Txt>
        <Txt as="span" variant="meta" tone="faint">
          Last 24h
        </Txt>
        <ChevronRight
          aria-hidden="true"
          className="ml-auto size-4 text-muted-foreground transition-transform duration-normal group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </span>
      <MetricsBody isChecking={isChecking} showsMetrics={showsActivity} />
    </Link>
  );
}

function MetricsBody({ isChecking, showsMetrics }: { isChecking: boolean; showsMetrics: boolean }) {
  if (isChecking) return <MetricsSummary hourly={emptyHourly} />;
  if (showsMetrics) return <LastDayAgentsMetrics />;
  return (
    <Txt as="span" variant="caption" tone="muted">
      Turn on observability storage to see runs, tokens and cost here.
    </Txt>
  );
}

const noActivity = Array.from<number>({ length: HOURS_SHOWN }).fill(0);
const emptyHourly = { runs: noActivity, errors: noActivity, tokens: noActivity, cost: noActivity };

function LastDayAgentsMetrics() {
  const filters = useMetricsQueryFilters({
    datePreset: '24h',
    customRange: undefined,
    dimensionalFilter: agentRunsFilter,
    dimensionalFilterKey: JSON.stringify(agentRunsFilter),
  });
  const [now] = useState(Date.now);
  const runs = useAgentRunsKpiMetrics(filters);
  const tokens = useTotalTokensKpiMetrics(filters);
  const cost = useModelCostKpiMetrics(filters);
  const hourlyRuns = useAgentsHourlyRuns(filters);
  const timeline = useTokenUsageTimeSeries(filters);
  const tokenPoints = timeline.data?.data ?? [];
  const hourly = {
    runs: hourlyBuckets(hourlyRuns.data?.runs ?? [], HOURS_SHOWN, now),
    errors: hourlyBuckets(hourlyRuns.data?.errors ?? [], HOURS_SHOWN, now),
    tokens: hourlyBuckets(
      tokenPoints.map(point => ({ tsMs: point.tsMs, value: point.total })),
      HOURS_SHOWN,
      now,
    ),
    cost: hourlyBuckets(
      tokenPoints.map(point => ({ tsMs: point.tsMs, value: point.cost ?? 0 })),
      HOURS_SHOWN,
      now,
    ),
  };
  const errors = hourlyRuns.data && hourly.errors.reduce((sum, value) => sum + value, 0);

  return (
    <MetricsSummary
      hourly={hourly}
      cost={cost.data?.cost != null ? formatUsd(cost.data.cost) : undefined}
      runs={runs.data && formatCount(runs.data.value)}
      runsChange={runs.data?.changePercent}
      tokens={tokens.data && formatCount(tokens.data.value)}
      errors={errors === undefined ? undefined : formatCount(errors)}
      hasErrors={Boolean(errors)}
    />
  );
}

function MetricsSummary({
  hourly,
  cost,
  runs,
  runsChange,
  tokens,
  errors,
  hasErrors = false,
}: {
  hourly: typeof emptyHourly;
  cost?: string;
  runs?: string;
  runsChange?: number | null;
  tokens?: string;
  errors?: string;
  hasErrors?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Txt as="span" variant="meta" tone="muted">
          Cost
        </Txt>
        <span className="text-title text-foreground tabular-nums">{cost ?? '–'}</span>
        <ActivitySparkline
          runsPerBucket={hourly.cost}
          peak={Math.max(...hourly.cost)}
          label="Cost per hour over the last 24 hours"
          height={36}
          className="text-chart-purple"
        />
      </div>
      <dl className="flex flex-col gap-2">
        <TrendRow label="Runs" value={runs} change={runsChange} hourly={hourly.runs} className="text-chart-blue" />
        <TrendRow label="Tokens" value={tokens} hourly={hourly.tokens} className="text-chart-amber" />
        <TrendRow label="Errors" value={errors} hourly={hourly.errors} className="text-chart-red" alert={hasErrors} />
      </dl>
    </div>
  );
}

function TrendRow({
  label,
  value,
  change,
  hourly,
  className,
  alert = false,
}: {
  label: string;
  value: string | undefined;
  change?: number | null;
  hourly: number[];
  className: string;
  alert?: boolean;
}) {
  const showsChange = change != null && Math.abs(change) >= 0.5;
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3">
      <Txt as="dt" variant="meta" tone="muted">
        {label}
      </Txt>
      <ActivitySparkline
        runsPerBucket={hourly}
        peak={Math.max(...hourly)}
        label={`${label} per hour over the last 24 hours`}
        height={16}
        className={className}
      />
      <dd className="flex items-baseline justify-end gap-1.5 tabular-nums">
        {showsChange && (
          <span className="text-meta text-muted-foreground">{`${change > 0 ? '+' : ''}${change.toFixed(0)}%`}</span>
        )}
        <span className={cn('text-label', alert ? 'text-destructive-foreground' : 'text-foreground')}>
          {value ?? '–'}
        </span>
      </dd>
    </div>
  );
}
