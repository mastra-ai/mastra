import type { DraggableProvided, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import { SankeyChart } from './sankey-chart';
import type { SankeyChartCurveSelection } from './sankey-chart-utils';
import { Sankey, useSankey } from './sankey-context';
import { Checkbox } from '@/ds/components/Checkbox';

const data = [
  { channel: 'Search', region: 'Europe', outcome: 'Won' },
  { channel: 'Search', region: 'Europe', outcome: 'Lost' },
  { channel: 'Search', region: 'North America', outcome: 'Won' },
  { channel: 'Referral', region: 'North America', outcome: 'Won' },
  { channel: 'Referral', region: 'Asia Pacific', outcome: 'Lost' },
  { channel: 'Partner', region: 'Europe', outcome: 'Won' },
];

const columns = [
  { id: 'channel', label: 'Channel' },
  { id: 'region', label: 'Region' },
  { id: 'outcome', label: 'Outcome' },
];

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
      <Sankey data={data} columns={columns}>
        <SankeyChart />
      </Sankey>
    </div>
  ),
};

function UserLandControls() {
  const { columns: controlColumns, toggleColumn, reorderColumns } = useSankey();
  const visibleColumns = controlColumns.filter(column => column.visible);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderColumns(result.source.index, result.destination.index);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sankey-story-columns" direction="horizontal">
        {(provided: DroppableProvided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap items-center gap-2">
            {controlColumns.map(column => {
              const checkbox = (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={column.visible}
                    onCheckedChange={() => toggleColumn(column.id)}
                    aria-label={`Include ${column.label}`}
                  />
                  <span>{column.label}</span>
                </label>
              );

              if (!column.visible) {
                return (
                  <div
                    key={column.id}
                    className="border-border1 bg-surface2 text-ui-sm text-neutral5 rounded-md border px-2.5 py-1.5"
                  >
                    {checkbox}
                  </div>
                );
              }

              const visibleIndex = visibleColumns.findIndex(item => item.id === column.id);
              return (
                <Draggable key={column.id} draggableId={column.id} index={visibleIndex}>
                  {(dragProvided: DraggableProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className="border-border1 bg-surface2 text-ui-sm text-neutral5 flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                    >
                      {checkbox}
                      <button
                        type="button"
                        {...dragProvided.dragHandleProps}
                        className="text-neutral3 focus-visible:ring-neutral5 rounded-sm outline-hidden focus-visible:ring-1"
                        aria-label={`Reorder ${column.label}`}
                      >
                        <GripVertical className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

export const Interactive: Story = {
  render: () => (
    <div className="w-full p-8">
      <Sankey data={data} columns={columns}>
        <div className="flex min-w-0 flex-col gap-4">
          <UserLandControls />
          <SankeyChart />
        </div>
      </Sankey>
    </div>
  ),
};

export const ClickableCurves: Story = {
  render: function ClickableCurvesStory() {
    const [selection, setSelection] = useState<SankeyChartCurveSelection>();

    return (
      <div className="w-full space-y-4 p-8">
        <Sankey data={data} columns={columns}>
          <SankeyChart onCurveClick={setSelection} />
        </Sankey>
        <div className="border-border1 bg-surface2 text-ui-sm text-neutral4 rounded-md border p-3">
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
      <Sankey data={[]} columns={columns}>
        <SankeyChart />
      </Sankey>
    </div>
  ),
};
