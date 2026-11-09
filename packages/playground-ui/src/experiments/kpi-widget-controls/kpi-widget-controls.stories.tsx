import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DashboardGrid, DashboardGridCell, DashboardGridRow } from '@/domains/dashboards/components/dashboard-grid';
import { AlertAction, PinAction } from '@/domains/dashboards/components/widget-controls';
import type { WidgetPin } from '@/domains/dashboards/widget-kind';
import { ChartCard } from '@/domains/metrics/components/chart-card';
import { KpiCard } from '@/domains/metrics/components/kpi-card';
import { Card } from '@/ds/components/Card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';
import {
  count,
  ms,
  percentileSeries,
  requestsByHour,
  statusSeries,
} from '@/ds/components/MetricsCard/metrics-story-data';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { MetricsLineChart } from '@/ds/components/MetricsLineChart';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

// The four figures the default agent dashboard's KPI widget shows (see dashboard-renderer.stories.tsx).
type Figure = {
  label: string;
  icon: LucideIcon;
  value: string;
  change?: number;
  previous?: string;
  lowerIsBetter?: boolean;
  detail: string;
};

const figures: Figure[] = [
  { label: 'Agent runs', icon: BotIcon, value: '12.4K', change: 8.2, previous: '11.5K', detail: 'in this range' },
  { label: 'Threads', icon: MessagesSquareIcon, value: '1.9K', change: -3.1, previous: '2K', detail: 'in this range' },
  { label: 'Tokens', icon: HashIcon, value: '48.2M', change: 12.7, previous: '42.8M', detail: 'input + output' },
  {
    label: 'Cost',
    icon: CoinsIcon,
    value: '$312.40',
    change: 4.9,
    previous: '$297.80',
    lowerIsBetter: true,
    detail: 'estimated',
  },
];

const COMPARISON = 'vs previous 24h';

type Controls = {
  editing: boolean;
  dragHandle?: MetricsCardDragHandleProps;
  pin: WidgetPin;
  alert: ReactNode;
};

/** Hidden until the widget is hovered or holds focus, like a chart card's `actions`. */
const reveal =
  'opacity-0 transition-opacity duration-fast group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 motion-reduce:transition-none';

function Figures() {
  return (
    <MetricsCardGroup>
      {figures.map(f => (
        <KpiCard key={f.label} {...f} comparison={COMPARISON} />
      ))}
    </MetricsCardGroup>
  );
}

function PinAndAlert({ pin, alert, editing }: Controls) {
  return (
    <div className={cn('flex shrink-0 items-center gap-1', !editing && !pin.isPinned && reveal)}>
      {alert}
      <PinAction {...pin} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Current: grip | figures | alert + pin as siblings (kpis-widget.tsx) */
/* ------------------------------------------------------------------ */

function CurrentLayout({ dragHandle, pin, alert }: Controls) {
  return (
    <div className="flex items-center gap-1.5">
      {dragHandle && <MetricsCard.DragHandle {...dragHandle} />}
      <div className="min-w-0 flex-1">
        <Figures />
      </div>
      {alert}
      <PinAction {...pin} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A: a header strip above the group                                  */
/* ------------------------------------------------------------------ */

function HeaderStripLayout(controls: Controls) {
  const { dragHandle } = controls;
  return (
    <div className="group/widget grid gap-2">
      <div className="flex h-control-sm items-center gap-1.5">
        {dragHandle && <MetricsCard.DragHandle {...dragHandle} />}
        <Txt as="span" variant="eyebrow" tone="muted" className="min-w-0 flex-1 truncate">
          Overview
        </Txt>
        <PinAndAlert {...controls} />
      </div>
      <Figures />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* B: grip in the first card, alert + pin in the last                 */
/* ------------------------------------------------------------------ */

function FigureCard({ figure, leading, trailing }: { figure: Figure; leading?: ReactNode; trailing?: ReactNode }) {
  const Icon = figure.icon;
  return (
    <MetricsKpiCard>
      <div className="flex min-w-0 items-center gap-1.5">
        {leading}
        <MetricsKpiCard.Label icon={<Icon />} className="min-w-0 flex-1">
          {figure.label}
        </MetricsKpiCard.Label>
        {trailing}
      </div>
      <MetricsKpiCard.ValueRow className="mt-1">
        <MetricsKpiCard.Value>{figure.value}</MetricsKpiCard.Value>
        {figure.change !== undefined && (
          <MetricsKpiCard.Change
            changePct={figure.change}
            comparison={COMPARISON}
            lowerIsBetter={figure.lowerIsBetter}
            prevValue={figure.previous}
          />
        )}
      </MetricsKpiCard.ValueRow>
      <MetricsKpiCard.Footer detail={figure.detail} prevValue={figure.previous} />
    </MetricsKpiCard>
  );
}

function InCardLayout(controls: Controls) {
  const { dragHandle } = controls;
  const last = figures.length - 1;
  return (
    <div className="group/widget">
      <MetricsCardGroup>
        {figures.map((f, i) => (
          <FigureCard
            key={f.label}
            figure={f}
            leading={i === 0 && dragHandle ? <MetricsCard.DragHandle {...dragHandle} /> : undefined}
            trailing={
              i === last ? (
                <div className="-my-1">
                  <PinAndAlert {...controls} />
                </div>
              ) : undefined
            }
          />
        ))}
      </MetricsCardGroup>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* C: a floating toolbar on the group's top-right corner              */
/* ------------------------------------------------------------------ */

// Hover-only in every state (editing, pinned): it never takes room, so the KPI row keeps the grid's
// edges and gaps. Focus inside it, or its alert menu being open, keeps it shown.
const floatingReveal =
  'opacity-0 transition-opacity duration-fast group-hover/widget:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100 motion-reduce:transition-none';

function FloatingToolbar({ dragHandle, pin, alert }: Controls) {
  return (
    <Card className={cn('absolute -top-4 left-3 z-10 flex items-center gap-0.5 p-0.5', floatingReveal)}>
      {dragHandle && <MetricsCard.DragHandle {...dragHandle} className="my-0" />}
      {alert}
      <PinAction {...pin} />
    </Card>
  );
}

function FloatingLayout(controls: Controls) {
  return (
    <div className="group/widget relative">
      <Figures />
      <FloatingToolbar {...controls} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* D: an edit frame around the group; the floating toolbar at rest    */
/* ------------------------------------------------------------------ */

function EditFrameLayout(controls: Controls) {
  const { editing, dragHandle } = controls;
  if (!editing) return <FloatingLayout {...controls} />;
  return (
    // The negative margin puts the frame in the gap, so the cards keep the row's edges.
    <div className="group/widget -m-2 grid gap-2 rounded-xl border border-dashed border-border-strong p-2">
      <div className="flex h-control-sm items-center gap-1.5">
        {dragHandle && <MetricsCard.DragHandle {...dragHandle} />}
        <Txt as="span" variant="label" tone="muted" className="min-w-0 flex-1 truncate">
          KPIs · {figures.length} figures
        </Txt>
        <PinAndAlert {...controls} />
      </div>
      <Figures />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The dashboard around the KPI row                                   */
/* ------------------------------------------------------------------ */

const LAYOUTS = {
  current: CurrentLayout,
  headerStrip: HeaderStripLayout,
  inCard: InCardLayout,
  floating: FloatingLayout,
  editFrame: EditFrameLayout,
} as const;

type DashboardProps = {
  layout: keyof typeof LAYOUTS;
  editing: boolean;
  pinned: boolean;
  withAlert: boolean;
};

const chartBody = { data: requestsByHour, height: 'fill', xLabels: 'edges', showYAxis: false } as const;

function ChartWidget({
  title,
  total,
  editing,
  children,
}: {
  title: string;
  total: string;
  editing: boolean;
  children: ReactNode;
}) {
  const [isPinned, onPin] = useState(false);
  const pin = <PinAction isPinned={isPinned} onPin={onPin} name={title} />;
  return (
    <ChartCard
      title={title}
      total={total}
      dragHandle={editing ? { 'aria-label': `Move ${title}`, draggable: true } : undefined}
      actions={isPinned ? undefined : pin}
      persistentActions={isPinned ? pin : undefined}
    >
      {children}
    </ChartCard>
  );
}

// Keyed on `pinned` so the Controls panel resets the click-driven pin state.
function Dashboard(props: DashboardProps) {
  return <DashboardBody key={String(props.pinned)} {...props} />;
}

function DashboardBody({ layout, editing, pinned, withAlert }: DashboardProps) {
  const [isPinned, onPin] = useState(pinned);
  const Layout = LAYOUTS[layout];
  const controls: Controls = {
    editing,
    dragHandle: editing ? { 'aria-label': 'Move KPIs', draggable: true } : undefined,
    pin: { isPinned, onPin, name: 'KPIs' },
    alert: withAlert ? (
      <AlertAction action={{ href: '#alerts/new' }} label="Create alert from KPIs" LinkComponent="a" />
    ) : undefined,
  };
  return (
    <DashboardGrid className="p-8">
      <DashboardGridRow>
        <DashboardGridCell span={12}>
          <Layout {...controls} />
        </DashboardGridCell>
      </DashboardGridRow>
      <DashboardGridRow>
        <DashboardGridCell span={6}>
          <ChartWidget title="Requests by status" total={count(1_284_000)} editing={editing}>
            <MetricsLineChart {...chartBody} series={statusSeries} valueFormatter={count} />
          </ChartWidget>
        </DashboardGridCell>
        <DashboardGridCell span={6}>
          <ChartWidget title="Latency" total={ms(412)} editing={editing}>
            <MetricsLineChart {...chartBody} series={percentileSeries} valueFormatter={ms} />
          </ChartWidget>
        </DashboardGridCell>
      </DashboardGridRow>
    </DashboardGrid>
  );
}

const meta = {
  title: 'Experiments/Dashboards/KPI Widget Controls',
  component: Dashboard,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: { layout: 'floating', editing: true, pinned: false, withAlert: true },
  argTypes: {
    layout: { control: 'select', options: Object.keys(LAYOUTS) },
  },
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Floating: Story = {};
export const Current: Story = { args: { layout: 'current' } };
export const HeaderStrip: Story = { args: { layout: 'headerStrip' } };
export const InCard: Story = { args: { layout: 'inCard' } };
export const EditFrame: Story = { args: { layout: 'editFrame' } };
export const FloatingPinnedAtRest: Story = { args: { editing: false, pinned: true } };
