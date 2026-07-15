import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SankeyChart } from './sankey-chart';
import type { SankeyChartCurveSelection } from './sankey-chart-utils';

const data = [
  { channel: 'Search', region: 'Europe', outcome: 'Won' },
  { channel: 'Search', region: 'Europe', outcome: 'Lost' },
  { channel: 'Search', region: 'North America', outcome: 'Won' },
  { channel: 'Referral', region: 'North America', outcome: 'Won' },
  { channel: 'Referral', region: 'Asia Pacific', outcome: 'Lost' },
  { channel: 'Partner', region: 'Europe', outcome: 'Won' },
];

const columns = (
  <>
    <SankeyChart.Column id="channel" label="Channel" />
    <SankeyChart.Column id="region" label="Region" />
    <SankeyChart.Column id="outcome" label="Outcome" />
  </>
);

const meta: Meta<typeof SankeyChart> = {
  title: 'Metrics/SankeyChart',
  component: SankeyChart,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof SankeyChart>;

export const Default: Story = {
  render: () => (
    <div className="w-full p-8">
      <SankeyChart data={data}>{columns}</SankeyChart>
    </div>
  ),
};

export const Interactive: Story = {
  render: function InteractiveStory() {
    const [columnOrder, setColumnOrder] = useState(['channel', 'region', 'outcome']);
    const [visibleColumnIds, setVisibleColumnIds] = useState(columnOrder);

    return (
      <div className="w-full p-8">
        <SankeyChart
          data={data}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
        >
          {columns}
        </SankeyChart>
      </div>
    );
  },
};

export const ClickableCurves: Story = {
  render: function ClickableCurvesStory() {
    const [selection, setSelection] = useState<SankeyChartCurveSelection>();

    return (
      <div className="w-full space-y-4 p-8">
        <SankeyChart data={data} onCurveClick={setSelection}>
          {columns}
        </SankeyChart>
        <div className="rounded-md border border-border1 bg-surface2 p-3 text-ui-sm text-neutral4">
          {selection
            ? `${selection.source.column.label}: ${selection.source.value} → ${selection.target.column.label}: ${selection.target.value} (${selection.records.length} records)`
            : 'Select a curve to inspect its records.'}
        </div>
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <div className="w-full p-8">
      <SankeyChart data={[]}>{columns}</SankeyChart>
    </div>
  ),
};
