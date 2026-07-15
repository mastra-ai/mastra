import type { DraggableProvided, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ResponsiveContainer, Sankey } from 'recharts';
import { buildSankeyChartGraph, getSankeyChartCurveSelection, reorderSankeyChartColumns } from './sankey-chart-utils';
import type { SankeyChartColumn, SankeyChartCurveSelection, SankeyChartRecord } from './sankey-chart-utils';
import { buildSankeyHueMap, nodeColor, nodeColorVivid } from './sankeyColor';
import { Checkbox } from '@/ds/components/Checkbox';
import { Colors } from '@/ds/tokens';
import { cn } from '@/lib/utils';

export type SankeyChartProps = {
  data: Array<SankeyChartRecord>;
  columns: Array<SankeyChartColumn>;
  height?: CSSProperties['height'];
  className?: string;
  columnOrder?: Array<string>;
  onColumnOrderChange?: (columnOrder: Array<string>) => void;
  visibleColumnIds?: Array<string>;
  onVisibleColumnIdsChange?: (columnIds: Array<string>) => void;
  onCurveClick?: (selection: SankeyChartCurveSelection) => void;
};

export function SankeyChart({
  data,
  columns,
  height = 320,
  className,
  columnOrder,
  onColumnOrderChange,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  onCurveClick,
}: SankeyChartProps) {
  const columnIds = columns.map(column => column.id);
  const [internalOrder, setInternalOrder] = useState(columnIds);
  const [internalVisibleIds, setInternalVisibleIds] = useState(columnIds);
  const [hoveredSourceName, setHoveredSourceName] = useState<string>();
  const orderedColumns = orderColumns(columns, columnOrder ?? internalOrder);
  const visibleIds = new Set(visibleColumnIds ?? internalVisibleIds);
  const enabledColumns = orderedColumns.filter(column => visibleIds.has(column.id));
  const graph = buildSankeyChartGraph(data, enabledColumns);
  const nodeNamesKey = graph.nodes.map(node => String(node.value)).join('\u0000');
  const hueMap = useMemo(
    () => buildSankeyHueMap(nodeNamesKey === '' ? [] : nodeNamesKey.split('\u0000')),
    [nodeNamesKey],
  );
  const lastColumnId = enabledColumns.at(-1)?.id;

  const setVisibleColumns = (nextIds: Array<string>) => {
    if (visibleColumnIds === undefined) setInternalVisibleIds(nextIds);
    onVisibleColumnIdsChange?.(nextIds);
  };

  const setColumnOrder = (nextOrder: Array<string>) => {
    if (columnOrder === undefined) setInternalOrder(nextOrder);
    onColumnOrderChange?.(nextOrder);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reorderedEnabled = reorderSankeyChartColumns(enabledColumns, result.source.index, result.destination.index);
    const enabledIterator = reorderedEnabled[Symbol.iterator]();
    const nextColumns = orderedColumns.map(column =>
      visibleIds.has(column.id) ? (enabledIterator.next().value ?? column) : column,
    );
    setColumnOrder(nextColumns.map(column => column.id));
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sankey-chart-columns" direction="horizontal">
          {(provided: DroppableProvided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex flex-wrap items-center gap-2"
              aria-label="Sankey chart columns"
            >
              {orderedColumns.map(column => {
                const isEnabled = visibleIds.has(column.id);
                const enabledIndex = enabledColumns.findIndex(enabledColumn => enabledColumn.id === column.id);
                const checkbox = (
                  <>
                    <Checkbox
                      checked={isEnabled}
                      onCheckedChange={checked => {
                        const nextIds = checked
                          ? orderedColumns
                              .filter(item => visibleIds.has(item.id) || item.id === column.id)
                              .map(item => item.id)
                          : orderedColumns
                              .filter(item => visibleIds.has(item.id) && item.id !== column.id)
                              .map(item => item.id);
                        setVisibleColumns(nextIds);
                      }}
                      aria-label={`Include ${column.label}`}
                    />
                    <span>{column.label}</span>
                  </>
                );

                if (!isEnabled) {
                  return (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 rounded-md border border-border1 bg-surface2 px-2.5 py-1.5 text-ui-sm text-neutral5"
                    >
                      {checkbox}
                    </label>
                  );
                }

                return (
                  <Draggable key={column.id} draggableId={column.id} index={enabledIndex}>
                    {(dragProvided: DraggableProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="flex items-center gap-2 rounded-md border border-border1 bg-surface2 px-2.5 py-1.5 text-ui-sm text-neutral5"
                      >
                        <label className="flex items-center gap-2">{checkbox}</label>
                        <button
                          type="button"
                          {...dragProvided.dragHandleProps}
                          className="rounded-sm text-neutral3 outline-hidden focus-visible:ring-1 focus-visible:ring-neutral5"
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

      {graph.links.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-md border border-border1 text-ui-sm text-neutral3"
          style={{ height }}
        >
          Select at least two columns with data to display a flow
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 800, height: typeof height === 'number' ? height : 320 }}
          >
            <Sankey
              data={graph}
              nodeWidth={7}
              nodePadding={18}
              margin={{ top: 40, right: 120, bottom: 12, left: 120 }}
              node={(props: SankeyNodeRendererProps) => {
                const node = graph.nodes[props.index];
                const showColumnLabel = node
                  ? graph.nodes.findIndex(candidate => candidate.column.id === node.column.id) === props.index
                  : false;
                return (
                  <SankeyNode
                    {...props}
                    hueMap={hueMap}
                    columnLabel={node?.column.label}
                    showColumnLabel={showColumnLabel}
                    isLastColumn={node?.column.id === lastColumnId}
                    onHoverChange={setHoveredSourceName}
                  />
                );
              }}
              link={(props: SankeyLinkRendererProps) => {
                const link = graph.links[props.index];
                return (
                  <SankeyLink
                    {...props}
                    hueMap={hueMap}
                    highlighted={String(props.payload.source.name ?? '') === hoveredSourceName}
                    onHoverChange={setHoveredSourceName}
                    clickable={onCurveClick !== undefined}
                    onSelect={() => {
                      if (link) onCurveClick?.(getSankeyChartCurveSelection(link));
                    }}
                  />
                );
              }}
            />
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

type SankeyNodeRendererProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name?: string | number; value?: string | number };
};

type SankeyLinkRendererProps = {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
  payload: { source: { name?: string | number }; target: { name?: string | number } };
};

type SankeyNodeProps = SankeyNodeRendererProps & {
  hueMap: Record<string, number>;
  columnLabel?: string;
  showColumnLabel: boolean;
  isLastColumn: boolean;
  onHoverChange: (sourceName: string | undefined) => void;
};

function SankeyNode({
  x,
  y,
  width,
  height,
  payload,
  hueMap,
  columnLabel,
  showColumnLabel,
  isLastColumn,
  onHoverChange,
}: SankeyNodeProps) {
  const name = typeof payload.name === 'string' || typeof payload.name === 'number' ? String(payload.name) : '';
  const value = typeof payload.value === 'string' || typeof payload.value === 'number' ? String(payload.value) : '';
  const labelX = isLastColumn ? x - 8 : x + width + 8;
  const textAnchor = isLastColumn ? 'end' : 'start';
  const hue = hueMap[name] ?? 0;

  return (
    <g onMouseEnter={() => onHoverChange(name)} onMouseLeave={() => onHoverChange(undefined)}>
      {showColumnLabel && columnLabel ? (
        <text x={x + width / 2} y={18} textAnchor="middle" fill={Colors.neutral5} fontSize={12} fontWeight={600}>
          {columnLabel}
        </text>
      ) : null}
      <rect x={x} y={y} width={width} height={height} rx={3} fill={nodeColor(hue)} />
      <text
        x={labelX}
        y={y + height / 2 - 4}
        textAnchor={textAnchor}
        fill={Colors.neutral5}
        fontSize={12.5}
        fontFamily="var(--font-mono)"
        paintOrder="stroke"
        stroke={Colors.surface1}
        strokeWidth={3}
        strokeLinejoin="round"
      >
        {name}
      </text>
      <text x={labelX} y={y + height / 2 + 10} textAnchor={textAnchor} fill={Colors.neutral3} fontSize={10.5}>
        {value}
      </text>
    </g>
  );
}

type SankeyLinkProps = SankeyLinkRendererProps & {
  hueMap: Record<string, number>;
  highlighted: boolean;
  clickable: boolean;
  onHoverChange: (sourceName: string | undefined) => void;
  onSelect: () => void;
};

function SankeyLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  index,
  payload,
  hueMap,
  highlighted,
  clickable,
  onHoverChange,
  onSelect,
}: SankeyLinkProps) {
  const halfWidth = Math.max(0, linkWidth) / 2;
  const path = [
    `M${sourceX},${sourceY - halfWidth}`,
    `C${sourceControlX},${sourceY - halfWidth} ${targetControlX},${targetY - halfWidth} ${targetX},${targetY - halfWidth}`,
    `L${targetX},${targetY + halfWidth}`,
    `C${targetControlX},${targetY + halfWidth} ${sourceControlX},${sourceY + halfWidth} ${sourceX},${sourceY + halfWidth}`,
    'Z',
  ].join(' ');
  const sourceName = String(payload.source.name ?? '');
  const targetName = String(payload.target.name ?? '');
  const gradientId = `sankey-grad-${index}`;
  const vividGradientId = `${gradientId}-vivid`;
  const handleKeyDown = (event: KeyboardEvent<SVGPathElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect();
  };

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} x2={targetX}>
          <stop offset="0%" stopColor={nodeColor(hueMap[sourceName] ?? 0)} />
          <stop offset="100%" stopColor={nodeColor(hueMap[targetName] ?? 0)} />
        </linearGradient>
        <linearGradient id={vividGradientId} gradientUnits="userSpaceOnUse" x1={sourceX} x2={targetX}>
          <stop offset="0%" stopColor={nodeColorVivid(hueMap[sourceName] ?? 0)} />
          <stop offset="100%" stopColor={nodeColorVivid(hueMap[targetName] ?? 0)} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill={`url(#${highlighted ? vividGradientId : gradientId})`}
        fillOpacity={highlighted ? 0.75 : 0.32}
        stroke="none"
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={clickable ? 'Select Sankey curve' : undefined}
        onClick={clickable ? onSelect : undefined}
        onKeyDown={clickable ? handleKeyDown : undefined}
        onMouseEnter={() => onHoverChange(sourceName)}
        onMouseLeave={() => onHoverChange(undefined)}
        style={{ cursor: clickable ? 'pointer' : undefined, transition: 'fill-opacity 0.18s ease' }}
      />
    </g>
  );
}

function orderColumns(columns: Array<SankeyChartColumn>, order: Array<string>) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...columns].sort(
    (left, right) => (positions.get(left.id) ?? columns.length) - (positions.get(right.id) ?? columns.length),
  );
}
