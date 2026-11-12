import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import { KpiCard } from '../../../metrics/components/kpi-card';
import { alertAction } from '../../lib/alert-actions';
import { FORMATTERS } from '../../lib/format';
import type { DashboardResult } from '../../lib/requests';
import { answersById, exprRefs } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { kpiFigures } from './options';
import type { KpisOptions } from './options';
import { Card } from '@/ds/components/Card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';

const ICONS = { bot: BotIcon, coins: CoinsIcon, hash: HashIcon, threads: MessagesSquareIcon } as const;

const change = (pct: number | undefined) => (pct !== undefined && Number.isFinite(pct) ? pct : undefined);

export function KpisWidget({
  widget,
  views,
  gate,
  results,
  comparisonLabel,
  dragHandle,
  actions,
  alert,
}: WidgetKindProps<KpisOptions>) {
  const [view] = views;
  const figures =
    gate.status === 'ready' ? <KpisView view={view} results={results} comparisonLabel={comparisonLabel} /> : null;
  // A page filter a trace or span aggregate can't apply gates the widget before this is ready.
  const alertButton =
    gate.status === 'ready'
      ? alertAction(alert, widget, view, {
          page: gate.page,
          values: view.options.items.map(({ label, value }) => ({ label, value })),
        })
      : null;
  if (!dragHandle && !actions && !alertButton) return figures;
  // The group has no title to hold the grip, the alert and the host's actions, so they float over its top edge:
  // beside the figures they would narrow the row and break its alignment with the full-width cards around it.
  // Floating over the border, they wait for hover or focus, even while rearranging or pinned, so they never
  // sit on the cards' edges at rest. Touch screens can't hover, so there they always show. The group is a
  // `group/metrics-card`, so the host's `onCardHover` actions show with the floating card.
  return (
    <div className="group/metrics-card relative">
      {figures}
      <Card className="pointer-events-none absolute -top-4 left-3 z-10 flex items-center gap-0.5 p-0.5 opacity-0 transition-opacity duration-fast group-hover/metrics-card:pointer-events-auto group-hover/metrics-card:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 has-data-popup-open:pointer-events-auto has-data-popup-open:opacity-100 motion-reduce:transition-none pointer-coarse:pointer-events-auto pointer-coarse:opacity-100">
        {dragHandle && <MetricsCard.DragHandle {...dragHandle} className="my-0" />}
        {alertButton}
        {actions}
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
  const byId = answersById(view.queries, results.slice(0, view.queries.length));
  const previousById = answersById(view.queries, results.slice(view.queries.length));
  const answers = new Map([...byId].map(([id, r]) => [id, { current: r?.data, previous: previousById.get(id)?.data }]));
  return (
    <MetricsCardGroup>
      {view.options.items.map((item, i) => {
        const used = [...new Set(exprRefs(item.value).map(r => r.query))]
          .map(id => byId.get(id))
          .filter((r): r is DashboardResult => r !== undefined);
        const figures = kpiFigures(item.value, answers);
        const format = FORMATTERS[item.format].value;
        return (
          <KpiCard
            key={i}
            label={item.label}
            icon={item.icon && ICONS[item.icon]}
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
