import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import type {
  SankeyChartColumn,
  SankeyChartNodeSelection,
  SankeyChartRecord,
} from '@mastra/playground-ui/components/SankeyChart';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';

import { getSignalRecordNodeId, getSignalRecordNodeLabel, getSignalRecordNodeValue } from './sankey-signals-data';
import { SortableSignalHeaders } from './sortable-signal-headers';
import type { ThemeFlowResponse, TraceSignalName } from './types';

export function FlowCard({
  columns,
  records,
  stages,
  height,
  onNodeClick,
  isNodeClickable,
  drillInDisabledReason,
  onOrderChange,
  signalOrder,
  reorderDisabled,
}: {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
  stages: ThemeFlowResponse['stages'];
  height?: number;
  onNodeClick?: (selection: SankeyChartNodeSelection) => void;
  isNodeClickable?: (selection: SankeyChartNodeSelection) => boolean;
  drillInDisabledReason?: string;
  onOrderChange: (signalNames: TraceSignalName[]) => void;
  signalOrder: TraceSignalName[];
  reorderDisabled: boolean;
}) {
  const columnsById = new Map(columns.map(column => [column.id, column]));
  const linkedColumnIds = new Set(columnsById.keys());
  const orderedLinkedSignals = signalOrder.filter(signalName => linkedColumnIds.has(signalName));
  const orderedSignalSet = new Set(orderedLinkedSignals);
  const headerSignalNames = [
    ...orderedLinkedSignals,
    ...stages
      .map(stage => stage.signalName)
      .filter(signalName => linkedColumnIds.has(signalName) && !orderedSignalSet.has(signalName)),
  ];
  const chartColumns = headerSignalNames.flatMap(signalName => {
    const column = columnsById.get(signalName);
    return column ? [{ ...column, label: column.label.toUpperCase() }] : [];
  });
  const handleHeaderOrderChange = (reordered: TraceSignalName[]) => {
    const seen = new Set<TraceSignalName>(reordered);
    onOrderChange([...reordered, ...signalOrder.filter(name => !seen.has(name))]);
  };

  return (
    <Card
      aria-label="Trace signal theme flow"
      as="section"
      className="relative min-w-0"
      elevation="elevated"
      title={drillInDisabledReason}
    >
      <span
        aria-hidden="true"
        className="bg-surface2 text-neutral3 absolute top-0 left-5 -translate-y-1/2 px-2 font-mono text-[10px] tracking-[0.18em]"
      >
        SIGNALS
      </span>
      <CardContent className="px-0 pt-4 pb-2 sm:pt-5 sm:pb-3">
        <SortableSignalHeaders
          signalNames={headerSignalNames}
          reorderDisabled={reorderDisabled}
          onOrderChange={handleHeaderOrderChange}
        />
        <div
          aria-label="Themes"
          className="text-neutral3 flex items-center gap-2 py-1 font-mono text-[10px] tracking-[0.18em]"
          role="separator"
        >
          <span aria-hidden="true" className="bg-border1 h-px w-5" />
          THEMES
          <span aria-hidden="true" className="bg-border1 h-px flex-1" />
        </div>
        <div aria-busy={reorderDisabled} data-testid="sankey-order-transition">
          <Sankey
            data={records}
            columns={chartColumns}
            columnOrder={chartColumns.map(column => column.id)}
            getColumnHue={column => getSignalHue(column.id)}
            getRecordNodeId={getSignalRecordNodeId}
            getRecordNodeLabel={getSignalRecordNodeLabel}
            getRecordNodeValue={getSignalRecordNodeValue}
            getRecordWeight={record => Number(record.traceCount)}
            getRecordLayoutWeight={record => Number(record.layoutTraceCount)}
          >
            <SankeyChart
              height={height ?? 'clamp(340px, 42vw, 460px)'}
              margin={{ top: 40, right: 32, bottom: 24, left: 32 }}
              onNodeClick={onNodeClick}
              isNodeClickable={isNodeClickable}
              hideColumnLabels
              geometryTransitionKey={chartColumns.map(column => column.id).join(':')}
            />
          </Sankey>
        </div>
      </CardContent>
    </Card>
  );
}
