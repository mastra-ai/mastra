import { MetricsLineChart } from '@mastra/playground-ui/components/MetricsLineChart';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronDown, CircleCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';

import type { FactoryMetrics } from '../services/metrics';
import { Sparkline } from './Sparkline';

const THROUGHPUT_SERIES = [{ dataKey: 'done', label: 'Completed work', color: 'var(--chart-2)' }];

// flushSync required — the transition captures the DOM synchronously after the callback
function morph(update: () => void) {
  const view = document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void> };
  };
  if (typeof view.startViewTransition !== 'function') {
    update();
    return;
  }
  // hidden tab or overlapping transition rejects `ready` — DOM update still lands
  view.startViewTransition(() => flushSync(update)).ready.catch(() => {});
}

export function ThroughputCard({ metrics, completed }: { metrics: FactoryMetrics; completed: number }) {
  const [expanded, setExpanded] = useState(false);
  const chartId = useId();
  const { daysCovered } = metrics;
  const averagePerDay = daysCovered === 0 ? 0 : completed / daysCovered;
  const perDay = `${averagePerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })} per day`;

  return (
    <div
      style={{ viewTransitionName: 'throughput-card' }}
      className={`border-border1 bg-surface3 hover:border-border2 group flex min-w-0 flex-col rounded-xl border p-4 transition-colors ${
        expanded ? 'col-span-full' : 'sm:col-span-2'
      }`}
    >
      <dt className="text-ui-xs text-icon3 flex items-center gap-1.5 tracking-wider uppercase [&>svg]:size-3.5">
        <CircleCheck aria-hidden="true" className="text-positive1" />
        Completed
      </dt>

      <dd className="m-0 mt-3 flex min-w-0 flex-col">
        <div className="relative flex items-center justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-header-xl text-icon6 font-medium tabular-nums">{completed}</span>
            <Txt as="span" variant="ui-xs" className="text-icon3">
              {perDay}
            </Txt>
          </span>

          <span className="flex shrink-0 items-center gap-3">
            {expanded ? null : (
              <Sparkline
                values={metrics.throughput.map(point => point.count)}
                color="var(--chart-2)"
                className="h-12 w-24 opacity-80 transition-opacity duration-200 group-hover:opacity-100 sm:w-44"
              />
            )}
            <ChevronDown
              aria-hidden="true"
              className={`text-icon3 size-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </span>

          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? chartId : undefined}
            aria-label={`Completed: ${completed}, ${perDay}. ${expanded ? 'Hide' : 'Show'} the daily completions chart`}
            onClick={() => morph(() => setExpanded(open => !open))}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>

        {expanded ? (
          <div
            id={chartId}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 mt-5 motion-safe:duration-300"
          >
            <Txt as="p" variant="ui-xs" className="text-icon3 m-0 mb-2">
              Daily completions over {daysCovered} days
            </Txt>
            <MetricsLineChart
              data={metrics.throughput.map(point => ({ time: point.date, done: point.count }))}
              series={THROUGHPUT_SERIES}
              height={260}
              xAxisInterval="preserveStartEnd"
              xAxisMinTickGap={40}
            />
          </div>
        ) : null}
      </dd>
    </div>
  );
}
