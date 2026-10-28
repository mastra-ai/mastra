import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import { KpiCard } from '../../../metrics/components/kpi-card';
import { useMetrics } from '../../../metrics/hooks/use-metrics';
import { formatCount, formatUsd } from '../../../metrics/lib/chart-format';
import { ViewGate } from '../../components/view-gate';
import type { DashboardQueryResult } from '../../hooks/use-dashboard-requests';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { exprRefs } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { kpiFigures } from './options';
import type { Aggregate, KpisOptions } from './options';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';

const ICONS = { bot: BotIcon, coins: CoinsIcon, hash: HashIcon, threads: MessagesSquareIcon } as const;

const FORMAT = { count: formatCount, usd: formatUsd };
const change = (pct: number | null) => (pct == null || !Number.isFinite(pct) ? undefined : pct);

export function KpisWidget({ views }: WidgetKindProps<KpisOptions>) {
  const [view] = views;
  return (
    <ViewGate queries={view.queries} pending={() => null}>
      {page => <KpisView view={view} page={page} />}
    </ViewGate>
  );
}

function KpisView({ view, page }: { view: ResolvedView<KpisOptions>; page: DashboardPageContext }) {
  const { comparisonLabel } = useMetrics();
  const results = useDashboardRequests(view.queries.map(q => buildRequest(q, page, {})));
  return (
    <MetricsCardGroup>
      {view.options.items.map((item, i) => {
        const used = [...new Set(exprRefs(item.value).map(r => r.query))]
          .map(q => results[q])
          .filter((r): r is DashboardQueryResult => r !== undefined);
        const figures = kpiFigures(
          item.value,
          results.map(r => r?.data as Aggregate | undefined),
        );
        const format = FORMAT[item.format];
        return (
          <KpiCard
            key={i}
            label={item.label}
            icon={ICONS[item.icon]}
            value={figures.value == null ? '—' : format(figures.value)}
            change={change(figures.change)}
            {...(item.lowerIsBetter ? { lowerIsBetter: true } : {})}
            detail={item.detail}
            previous={figures.previous == null ? undefined : format(figures.previous)}
            comparison={comparisonLabel}
            isLoading={used.some(r => r.isLoading)}
            isUpdating={used.some(r => r.isPlaceholderData)}
            isError={used.some(r => r.isError)}
          />
        );
      })}
    </MetricsCardGroup>
  );
}
