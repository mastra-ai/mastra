import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { setWidgetDragData } from './drag-data';
import { WidgetDragHandle } from './drag-handle';
import type { WidgetLayoutRow } from './layout';
import { WidgetLayout } from './widget-layout';
import type { WidgetDragHandleProps, WidgetLayoutChange } from './widget-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/ds/components/Card';
import { Txt } from '@/ds/components/Txt';

const TITLES: Record<string, string> = {
  tokens: 'Tokens and cost',
  latency: 'Latency p95',
  entities: 'Runs by entity',
  errors: 'Error rate',
  scores: 'Scores',
  runs: 'Runs',
  cost: 'Cost',
};

const PALETTE = [
  { kind: 'timeseries', label: 'Time series' },
  { kind: 'table', label: 'Table' },
  { kind: 'metric', label: 'Single metric' },
];

const SEEDED: WidgetLayoutRow[] = [
  {
    widgets: [
      { id: 'tokens', span: 6 },
      { id: 'latency', span: 3 },
      { id: 'errors', span: 3 },
    ],
  },
  {
    widgets: [
      { id: 'scores', span: 6 },
      { id: 'runs', span: 6 },
    ],
  },
  { widgets: [{ id: 'entities', span: 12 }] },
];

function PlaceholderWidget({ id, span, dragHandle }: { id: string; span: number; dragHandle: WidgetDragHandleProps }) {
  return (
    <Card elevation="flat" className="h-full min-h-40">
      <CardHeader className="flex-row items-center gap-1 space-y-0">
        <WidgetDragHandle {...dragHandle} className="-ml-2" />
        <CardTitle>{TITLES[id] ?? id}</CardTitle>
      </CardHeader>
      <CardContent>
        <Txt variant="body-sm" tone="muted">
          {span} / 12 columns
        </Txt>
      </CardContent>
    </Card>
  );
}

function Harness({ initial }: { initial: WidgetLayoutRow[] }) {
  const [rows, setRows] = useState(initial);
  const [lastChange, setLastChange] = useState<WidgetLayoutChange>();
  const [created, setCreated] = useState(0);

  const onRowsChange = (next: WidgetLayoutRow[], change: WidgetLayoutChange) => {
    setRows(next);
    setLastChange(change);
    if (change.type === 'insert') setCreated(count => count + 1);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Txt variant="label" tone="muted">
          Drag in a new widget:
        </Txt>
        {PALETTE.map(({ kind, label }) => (
          <div
            key={kind}
            draggable
            onDragStart={event => setWidgetDragData(event.dataTransfer, `${kind}-${created + 1}`)}
            className="bg-surface3 cursor-grab rounded-lg border border-border px-3 py-1.5 active:cursor-grabbing"
          >
            <Txt variant="body-sm">{label}</Txt>
          </div>
        ))}
        {lastChange && (
          <Txt variant="caption" tone="faint" className="ml-auto">
            Last change: {lastChange.type} {lastChange.widgetId}
          </Txt>
        )}
      </div>
      <WidgetLayout
        rows={rows}
        onRowsChange={onRowsChange}
        renderWidget={(w, dragHandle) => <PlaceholderWidget {...w} dragHandle={dragHandle} />}
        createWidget={() => `metric-${created + 1}`}
      />
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Dashboards/WidgetLayout',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  argTypes: { initial: { table: { disable: true } } },
};

export default meta;
type Story = StoryObj<typeof Harness>;

/**
 * Hover the layout for the resize handles between widgets and a + on every gap to add a widget there. Drag a
 * widget, or a palette item, into a gap; a line shows where it lands: horizontal for a new row, vertical to join a row.
 * Widths stay on the spans a dashboard stores (2, 3, 4, 6, 12), so two widgets alone in a row are
 * always 6 + 6 and their handle stays inert.
 */
export const Default: Story = {
  args: { initial: SEEDED },
};

/** Six widgets at the 2-column minimum: the top row shows no vertical drop lines, only new-row ones. */
export const FullRow: Story = {
  args: {
    initial: [
      { widgets: ['tokens', 'latency', 'errors', 'scores', 'runs', 'cost'].map(id => ({ id, span: 2 })) },
      { widgets: [{ id: 'entities', span: 12 }] },
    ],
  },
};

/** Nothing placed yet. */
export const Empty: Story = {
  args: { initial: [] },
};
