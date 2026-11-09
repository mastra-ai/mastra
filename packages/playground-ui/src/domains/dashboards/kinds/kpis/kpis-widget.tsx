import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import { KpiCard } from '../../../metrics/components/kpi-card';
import { formatCount, formatUsd } from '../../../metrics/lib/chart-format';
import { PinAction } from '../../components/widget-controls';
import { alertAction } from '../../lib/alert-actions';
import { valueOf } from '../../lib/answers';
import type { DashboardResult } from '../../lib/requests';
import { answersById, exprRefs } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { kpiFigures } from './options';
import type { KpisOptions } from './options';
import { Card } from '@/ds/components/Card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';
import { cn } from '@/lib/utils';

const ICONS = { bot: BotIcon, coins: CoinsIcon, hash: HashIcon, threads: MessagesSquareIcon } as const;

const FORMAT = { count: formatCount, usd: formatUsd };
const change = (pct: number | undefined) => (pct !== undefined && Number.isFinite(pct) ? pct : undefined);

export function KpisWidget({
  widget,
  views,
  gate,
  results,
  comparisonLabel,
  dragHandle,
  pin,
  alert,
}: WidgetKindProps<KpisOptions>) {
  const [view] = views;
  const figures =
    gate.status === 'ready' ? <KpisView view={view} results={results} comparisonLabel={comparisonLabel} /> : null;
  if (!dragHandle && !pin && !alert) return figures;
  // The group has no title to hold the grip, the alert and the pin, so they float over its top edge on hover:
  // beside the figures they would narrow the row and break its alignment with the full-width cards around it.
  return (
    <div className="group/kpis relative">
      {figures}
      <Card
        className={cn(
          'absolute -top-4 left-3 z-10 flex items-center gap-0.5 p-0.5',
          'opacity-0 transition-opacity duration-fast group-hover/kpis:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100 motion-reduce:transition-none',
        )}
      >
        {dragHandle && <MetricsCard.DragHandle {...dragHandle} className="my-0" />}
        {/* KPIs read metrics and scores aggregates only, which every page filter applies to. */}
        {gate.status === 'ready' &&
          alertAction(alert, widget, view, {
            page: gate.page,
            values: view.options.items.map(({ label, value }) => ({ label, value })),
          })}
        {pin && <PinAction {...pin} />}
      </Card>
    </div>
  );
}

function KpisView({
  view,
  results,
  comparisonLabel,
}: {
  view: ResolvedView<KpisOptions>;
  results: (DashboardResult | undefined)[];
  comparisonLabel: string;
}) {
  const byId = answersById(view.queries, results);
  const answers = new Map([...byId].map(([id, r]) => [id, valueOf(r?.data)]));
  return (
    <MetricsCardGroup>
      {view.options.items.map((item, i) => {
        const used = [...new Set(exprRefs(item.value).map(r => r.query))]
          .map(id => byId.get(id))
          .filter((r): r is DashboardResult => r !== undefined);
        const figures = kpiFigures(item.value, answers);
        const format = FORMAT[item.format];
        return (
          <KpiCard
            key={i}
            label={item.label}
            icon={ICONS[item.icon]}
            value={figures.value === undefined ? '—' : format(figures.value)}
            change={change(figures.change)}
            lowerIsBetter={item.lowerIsBetter}
            detail={item.detail}
            previous={figures.previous === undefined ? undefined : format(figures.previous)}
            comparison={comparisonLabel}
            isLoading={used.some(r => r.isLoading)}
            isUpdating={used.some(r => r.isRefetching)}
            isError={used.some(r => r.isError)}
          />
        );
      })}
    </MetricsCardGroup>
  );
}
