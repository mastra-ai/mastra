import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import { KpiCard } from '../../../metrics/components/kpi-card';
import { useMetrics } from '../../../metrics/hooks/use-metrics';
import { formatCount, formatUsd } from '../../../metrics/lib/chart-format';
import { ViewGate } from '../../components/view-gate';
import { PinAction } from '../../components/widget-controls';
import type { DashboardQueryResult } from '../../hooks/use-dashboard-requests';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { alertAction } from '../../lib/alert-actions';
import { valueOf } from '../../lib/answers';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { answersById, exprRefs } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { kpiFigures } from './options';
import type { KpisOptions } from './options';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';

const ICONS = { bot: BotIcon, coins: CoinsIcon, hash: HashIcon, threads: MessagesSquareIcon } as const;

const FORMAT = { count: formatCount, usd: formatUsd };
const change = (pct: number | undefined) => (pct !== undefined && Number.isFinite(pct) ? pct : undefined);

export function KpisWidget({ widget, views, dragHandle, pin, alert }: WidgetKindProps<KpisOptions>) {
  const [view] = views;
  const gate = (
    <ViewGate queries={view.queries} pending={() => null}>
      {page => <KpisView view={view} page={page} />}
    </ViewGate>
  );
  if (!dragHandle && !pin && !alert) return gate;
  // The group has no title of its own, so the grip, the alert and the pin sit beside it, there even before the figures load.
  return (
    <div className="flex items-center gap-1.5">
      {dragHandle && <MetricsCard.DragHandle {...dragHandle} />}
      <div className="min-w-0 flex-1">{gate}</div>
      {alert && (
        // KPIs read metrics and scores aggregates only, which every page filter applies to.
        <ViewGate queries={view.queries} pending={() => null}>
          {page => alertAction(alert, widget, view, { page })}
        </ViewGate>
      )}
      {pin && <PinAction {...pin} />}
    </div>
  );
}

function KpisView({ view, page }: { view: ResolvedView<KpisOptions>; page: DashboardPageContext }) {
  const { comparisonLabel } = useMetrics();
  const results = useDashboardRequests(view.queries.map(q => buildRequest(q, page, {})));
  const byId = answersById(view.queries, results);
  const answers = new Map([...byId].map(([id, r]) => [id, valueOf(r?.data)]));
  return (
    <MetricsCardGroup>
      {view.options.items.map((item, i) => {
        const used = [...new Set(exprRefs(item.value).map(r => r.query))]
          .map(id => byId.get(id))
          .filter((r): r is DashboardQueryResult => r !== undefined);
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
