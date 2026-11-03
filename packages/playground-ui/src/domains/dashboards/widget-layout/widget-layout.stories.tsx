import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { setWidgetDragData } from './drag-data';
import type { WidgetLayoutRow } from './layout';
import { WidgetLayout } from './widget-layout';
import type { WidgetLayoutChange } from './widget-layout';
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
      { id: 'latency', span: 6 },
    ],
  },
  { widgets: [{ id: 'entities', span: 12 }] },
];

function PlaceholderWidget({ id, span }: { id: string; span: number }) {
  return (
    <Card elevation="flat" className="h-full min-h-40">
      <CardHeader>
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
            className="cursor-grab rounded-lg border border-border bg-surface3 px-3 py-1.5 active:cursor-grabbing"
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
      <WidgetLayout rows={rows} onRowsChange={onRowsChange} renderWidget={w => <PlaceholderWidget {...w} />} />
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
 * Hover a widget for its move handle (top centre) and the resize handles between widgets. Drag a
 * widget, or a palette item, onto a blue line: horizontal for a new row, vertical to join a row.
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
