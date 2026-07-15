/* eslint-disable react-refresh/only-export-components -- Compound component parts are intentionally colocated. */
import type { DraggableProvided, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { Children, Fragment, isValidElement, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react';
import type { SankeyLinkProps, SankeyNodeProps } from 'recharts';
import { ResponsiveContainer, Sankey } from 'recharts';
import { buildSankeyChartGraph, getSankeyChartCurveSelection, reorderSankeyChartColumns } from './sankey-chart-utils';
import type { SankeyChartColumn, SankeyChartCurveSelection, SankeyChartRecord } from './sankey-chart-utils';
import { Checkbox } from '@/ds/components/Checkbox';
import { Colors } from '@/ds/tokens';
import { stringToColor } from '@/lib/colors';
import { cn } from '@/lib/utils';

export type SankeyChartColumnProps = SankeyChartColumn;

export type SankeyChartProps = {
  data: Array<SankeyChartRecord>;
  children: ReactNode;
  height?: CSSProperties['height'];
  className?: string;
  columnOrder?: Array<string>;
  onColumnOrderChange?: (columnOrder: Array<string>) => void;
  visibleColumnIds?: Array<string>;
  onVisibleColumnIdsChange?: (columnIds: Array<string>) => void;
  onCurveClick?: (selection: SankeyChartCurveSelection) => void;
};

function SankeyChartColumnDefinition(_: SankeyChartColumnProps) {
  return null;
}

function SankeyChartRoot({
  data,
  children,
  height = 320,
  className,
  columnOrder,
  onColumnOrderChange,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  onCurveClick,
}: SankeyChartProps) {
  const declaredColumns = getDeclaredColumns(children);
  const declaredIds = declaredColumns.map(column => column.id);
  const [internalOrder, setInternalOrder] = useState(declaredIds);
  const [internalVisibleIds, setInternalVisibleIds] = useState(declaredIds);
  const orderedColumns = orderColumns(declaredColumns, columnOrder ?? internalOrder);
  const visibleIds = new Set(visibleColumnIds ?? internalVisibleIds);
  const enabledColumns = orderedColumns.filter(column => visibleIds.has(column.id));
  const graph = buildSankeyChartGraph(data, enabledColumns);

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
              nodeWidth={10}
              nodePadding={18}
              margin={{ top: 40, right: 120, bottom: 12, left: 120 }}
              node={(props: SankeyNodeProps) => {
                const node = graph.nodes[props.index];
                const showColumnLabel = node
                  ? graph.nodes.findIndex(candidate => candidate.column.id === node.column.id) === props.index
                  : false;
                return <SankeyNode {...props} columnLabel={node?.column.label} showColumnLabel={showColumnLabel} />;
              }}
              link={(props: SankeyLinkProps) => {
                const link = graph.links[props.index];
                return (
                  <SankeyLink
                    {...props}
                    color={stringToColor(String(link?.sourceNode.value ?? ''), 68, 55)}
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

function SankeyNode({
  x,
  y,
  width,
  height,
  payload,
  columnLabel,
  showColumnLabel,
}: SankeyNodeProps & { columnLabel?: string; showColumnLabel: boolean }) {
  const name = typeof payload.name === 'string' || typeof payload.name === 'number' ? String(payload.name) : '';
  const labelOnRight = x < 200;

  return (
    <g>
      {showColumnLabel && columnLabel ? (
        <text x={x + width / 2} y={18} textAnchor="middle" fill={Colors.neutral5} fontSize={12} fontWeight={600}>
          {columnLabel}
        </text>
      ) : null}
      <rect x={x} y={y} width={width} height={height} rx={2} fill={Colors.neutral1} />
      <text
        x={labelOnRight ? x + width + 8 : x - 8}
        y={y + height / 2}
        dy="0.35em"
        textAnchor={labelOnRight ? 'start' : 'end'}
        fill={Colors.neutral5}
        fontSize={11}
        fontFamily="var(--font-mono)"
      >
        {name}
      </text>
    </g>
  );
}

function SankeyLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  color,
  clickable,
  onSelect,
}: SankeyLinkProps & { color: string; clickable: boolean; onSelect: () => void }) {
  const path = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  const handleKeyDown = (event: KeyboardEvent<SVGPathElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect();
  };

  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeOpacity={0.55}
      strokeWidth={Math.max(1, linkWidth)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? 'Select Sankey curve' : undefined}
      onClick={clickable ? onSelect : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      style={{ cursor: clickable ? 'pointer' : undefined }}
    />
  );
}

function getDeclaredColumns(children: ReactNode): Array<SankeyChartColumn> {
  return Children.toArray(children).flatMap(child => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return getDeclaredColumns(child.props.children);
    }
    if (!isValidElement<SankeyChartColumnProps>(child) || child.type !== SankeyChartColumnDefinition) return [];
    return [{ id: child.props.id, label: child.props.label }];
  });
}

function orderColumns(columns: Array<SankeyChartColumn>, order: Array<string>) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...columns].sort(
    (left, right) => (positions.get(left.id) ?? columns.length) - (positions.get(right.id) ?? columns.length),
  );
}

export const SankeyChart = Object.assign(SankeyChartRoot, {
  Column: SankeyChartColumnDefinition,
});

export type SankeyChartElement = ReactElement<SankeyChartColumnProps, typeof SankeyChartColumnDefinition>;
