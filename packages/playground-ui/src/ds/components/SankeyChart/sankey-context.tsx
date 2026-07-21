import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { buildSankeyChartGraph, reorderSankeyChartColumns } from './sankey-chart-utils';
import type { SankeyChartColumn, SankeyChartGraph, SankeyChartRecord } from './sankey-chart-utils';
import { buildSankeyHueMap } from './sankeyColor';

export type SankeyProps = {
  data: Array<SankeyChartRecord>;
  columns: Array<SankeyChartColumn>;
  children: ReactNode;
  columnOrder?: Array<string>;
  onColumnOrderChange?: (columnOrder: Array<string>) => void;
  visibleColumnIds?: Array<string>;
  onVisibleColumnIdsChange?: (columnIds: Array<string>) => void;
  getRecordWeight?: (record: SankeyChartRecord) => number;
  getRecordNodeId?: (record: SankeyChartRecord, column: SankeyChartColumn) => string;
  getRecordNodeLabel?: (record: SankeyChartRecord, column: SankeyChartColumn) => string;
  getColumnHue?: (column: SankeyChartColumn) => number;
};

export type SankeyControlColumn = SankeyChartColumn & {
  visible: boolean;
};

export type SankeyControls = {
  columns: Array<SankeyControlColumn>;
  toggleColumn: (columnId: string) => void;
  reorderColumns: (sourceIndex: number, destinationIndex: number) => void;
};

type SankeyRenderContext = {
  graph: SankeyChartGraph;
  enabledColumns: Array<SankeyChartColumn>;
  hueMap: Record<string, number>;
};

const SankeyControlsContext = createContext<SankeyControls | undefined>(undefined);
const SankeyRenderContext = createContext<SankeyRenderContext | undefined>(undefined);

export function Sankey({
  data,
  columns,
  children,
  columnOrder,
  onColumnOrderChange,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  getRecordWeight,
  getRecordNodeId,
  getRecordNodeLabel,
  getColumnHue,
}: SankeyProps) {
  const columnIds = columns.map(column => column.id);
  const [internalOrder, setInternalOrder] = useState(columnIds);
  const [internalVisibleIds, setInternalVisibleIds] = useState(columnIds);
  const orderedColumns = orderColumns(columns, columnOrder ?? internalOrder);
  const visibleIds = new Set(visibleColumnIds ?? internalVisibleIds);
  const enabledColumns = orderedColumns.filter(column => visibleIds.has(column.id));
  const graph = buildSankeyChartGraph(data, enabledColumns, getRecordWeight, getRecordNodeId, getRecordNodeLabel);
  const defaultHueMap = buildSankeyHueMap(graph.nodes.map(node => String(node.value)));
  const hueMap = Object.fromEntries(
    graph.nodes.map(node => [
      String(node.value),
      getColumnHue?.(node.column) ?? defaultHueMap[String(node.value)] ?? 0,
    ]),
  );

  const setVisibleColumns = (nextIds: Array<string>) => {
    if (visibleColumnIds === undefined) setInternalVisibleIds(nextIds);
    onVisibleColumnIdsChange?.(nextIds);
  };

  const setColumnOrder = (nextOrder: Array<string>) => {
    if (columnOrder === undefined) setInternalOrder(nextOrder);
    onColumnOrderChange?.(nextOrder);
  };

  const toggleColumn = (columnId: string) => {
    const nextIds = visibleIds.has(columnId)
      ? orderedColumns.filter(column => visibleIds.has(column.id) && column.id !== columnId).map(column => column.id)
      : orderedColumns.filter(column => visibleIds.has(column.id) || column.id === columnId).map(column => column.id);
    setVisibleColumns(nextIds);
  };

  const reorderColumns = (sourceIndex: number, destinationIndex: number) => {
    const reorderedEnabled = reorderSankeyChartColumns(enabledColumns, sourceIndex, destinationIndex);
    const enabledIterator = reorderedEnabled[Symbol.iterator]();
    const nextColumns = orderedColumns.map(column =>
      visibleIds.has(column.id) ? (enabledIterator.next().value ?? column) : column,
    );
    setColumnOrder(nextColumns.map(column => column.id));
  };

  const controlColumns = orderedColumns.map(column => ({ ...column, visible: visibleIds.has(column.id) }));

  return (
    <SankeyControlsContext.Provider value={{ columns: controlColumns, toggleColumn, reorderColumns }}>
      <SankeyRenderContext.Provider value={{ graph, enabledColumns, hueMap }}>{children}</SankeyRenderContext.Provider>
    </SankeyControlsContext.Provider>
  );
}

// Context providers and their hooks intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useSankey() {
  const context = useContext(SankeyControlsContext);
  if (!context) throw new Error('useSankey must be used within Sankey');
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSankeyRenderContext() {
  const context = useContext(SankeyRenderContext);
  if (!context) throw new Error('SankeyChart must be used within Sankey');
  return context;
}

function orderColumns(columns: Array<SankeyChartColumn>, order: Array<string>) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...columns].sort(
    (left, right) => (positions.get(left.id) ?? columns.length) - (positions.get(right.id) ?? columns.length),
  );
}
