import type { ReactNode } from 'react';

import { formatDuration } from '../../../../lib/date';
import type { FactoryMetrics } from '../services/metrics';
import { perDayDetail } from '../window';
import { Dial } from './Dial';
import { Meter, type MeterSegment } from './Meter';
import { PeriodChange } from './PeriodChange';
import { Sparkline } from './Sparkline';
import { Stat } from './Stat';

const EM_DASH = '—';

/** Big enough to read as a gauge, bled past the card's corner so it sits behind the figure. */
const RING = 'absolute -right-5 -bottom-6 size-28 opacity-50';
const RING_TICKS = 28;

/** Sources of the picked-up cards, not of everything the integrations filed. */
const SOURCE_LABELS: Record<string, string> = {
  'github:issue': 'GitHub',
  'github:pull-request': 'GitHub PRs',
  'linear:issue': 'Linear',
  manual: 'Manual',
};

/** The leading source keeps the accent; the rest step back from it. */
const MIX_PAINT = ['bg-chart-trend', 'bg-chart-trend/50', 'bg-chart-trend/25'];

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

interface Kpi {
  label: string;
  value: string;
  detail?: string;
  change?: ReactNode;
  art?: ReactNode;
}

/** The headline takes two columns, so four or five tiles still close their row. */
const COLUMNS: Record<number, string> = { 4: 'lg:grid-cols-5', 5: 'lg:grid-cols-6' };

function percent(value: number | null): string {
  return value === null ? EM_DASH : `${value}%`;
}

/** The series over the window, run under the figure and past the card's edge. */
function Trail({ values }: { values: (number | null)[] }) {
  return (
    <div className="absolute inset-x-0 -bottom-1 h-16 opacity-70">
      <Sparkline values={values} className="h-full w-full" />
    </div>
  );
}

/** Where the window's demand came from, biggest share first. */
function mixOf(sourceMix: FactoryMetrics['sourceMix'], total: number) {
  const ranked = [...sourceMix].sort((a, b) => b.count - a.count);
  const segments: MeterSegment[] = ranked
    .slice(0, MIX_PAINT.length)
    .map((entry, index) => ({ share: entry.count / total, className: MIX_PAINT[index]! }));
  const rest = ranked.slice(MIX_PAINT.length).reduce((sum, entry) => sum + entry.count, 0);
  if (rest > 0) segments.push({ share: rest / total, className: 'bg-icon2' });

  return {
    segments,
    keywords: ranked.slice(0, 2).map(entry => sourceLabel(entry.source)),
    described: ranked.map(entry => `${entry.count} ${sourceLabel(entry.source)}`).join(', '),
  };
}

function buildKpis(metrics: FactoryMetrics): Kpi[] {
  const { series, previous, daysCovered } = metrics;
  const completed = metrics.throughput.reduce((sum, point) => sum + point.count, 0);
  const { medianMs, p90Ms } = metrics.leadTime;
  const { rework } = metrics.funnel;

  const pickedUp = metrics.sourceMix.reduce((sum, entry) => sum + entry.count, 0);
  const passes = metrics.agentCoverage.reduce((total, row) => total + row.passes, 0);
  const mix = mixOf(metrics.sourceMix, pickedUp);
  const coverage = metrics.agentCoveragePercent;
  const bounced = rework.cards === 0 ? null : rework.percent;

  return [
    {
      label: 'Shipped',
      value: String(completed),
      detail: perDayDetail(completed, daysCovered),
      change: previous ? <PeriodChange current={completed} previous={previous.completed} better="higher" /> : null,
      art: <Trail values={metrics.throughput.map(point => point.count)} />,
    },
    {
      label: 'Picked up',
      value: String(pickedUp),
      detail: mix.keywords.join(' · '),
      // one source fills every tick and says nothing the keyword under it does not
      art:
        mix.segments.length > 1 ? (
          <div className="absolute inset-x-4 bottom-4">
            <Meter segments={mix.segments} label={`Picked up: ${mix.described}`} />
          </div>
        ) : undefined,
    },
    {
      label: 'Lead time',
      value: formatDuration(medianMs),
      detail: p90Ms === null ? undefined : `p90 ${formatDuration(p90Ms)}`,
      change:
        medianMs !== null && previous?.leadTimeMedianMs != null ? (
          <PeriodChange current={medianMs} previous={previous.leadTimeMedianMs} better="lower" />
        ) : null,
      art: <Trail values={series.leadTimeHours} />,
    },
    {
      label: 'Agent coverage',
      value: percent(coverage),
      detail: passes === 0 ? undefined : `${passes} stage passes`,
      change:
        coverage !== null && previous?.agentCoveragePercent != null ? (
          <PeriodChange current={coverage} previous={previous.agentCoveragePercent} better="higher" scale="points" />
        ) : null,
      art:
        coverage === null ? undefined : (
          <Dial share={coverage / 100} ticks={RING_TICKS} className={`${RING} text-chart-trend`} />
        ),
    },
    // a permanent 0% is the emptiest cell in the row; the funnel's arc says it in place
    ...(bounced === null
      ? []
      : [
          {
            label: 'Rework',
            value: `${bounced}%`,
            detail: `+${formatDuration(rework.medianExtraMs)} each`,
            change:
              previous?.reworkPercent == null ? null : (
                <PeriodChange current={bounced} previous={previous.reworkPercent} better="lower" scale="points" />
              ),
            art: <Dial share={bounced / 100} ticks={RING_TICKS} className={`${RING} text-warning1`} />,
          },
        ]),
  ];
}

/** The headline is wide; an odd tally widens the last tile, so no row ends on a hole. */
function tile(index: number, total: number): string {
  if (index === 0) return 'min-h-48 lg:col-span-2';
  return index === total - 1 && total % 2 === 1 ? 'min-h-48 max-lg:col-span-2' : 'min-h-48';
}

export function KpiStrip({ metrics }: { metrics: FactoryMetrics }) {
  const kpis = buildKpis(metrics);

  return (
    <dl className={`m-0 grid auto-rows-fr grid-cols-2 gap-3 ${COLUMNS[kpis.length]}`}>
      {kpis.map((kpi, index) => (
        <Stat key={kpi.label} {...kpi} className={tile(index, kpis.length)} />
      ))}
    </dl>
  );
}
