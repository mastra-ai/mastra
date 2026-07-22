import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, CSSProperties, KeyboardEvent } from 'react';
import { ResponsiveContainer, Sankey as RechartsSankey } from 'recharts';
import { getSankeyChartCurveSelection, truncateSankeyLabel } from './sankey-chart-utils';
import type { SankeyChartCurveSelection } from './sankey-chart-utils';
import { useSankeyRenderContext } from './sankey-context';
import { nodeColor, nodeColorVivid } from './sankeyColor';
import { Colors } from '@/ds/tokens';
import { cn } from '@/lib/utils';

const NODE_WIDTH = 7;
// Horizontal breathing room kept between neighbouring column labels so their
// centered text can never touch.
const LABEL_HORIZONTAL_GUTTER = 16;
const NAME_LABEL_FONT_SIZE = 11;
const COLUMN_LABEL_FONT_SIZE = 12;

export type SankeyChartProps = {
  height?: CSSProperties['height'];
  className?: string;
  margin?: ComponentProps<typeof RechartsSankey>['margin'];
  onCurveClick?: (selection: SankeyChartCurveSelection) => void;
};

export function SankeyChart({
  height = 320,
  className,
  margin = { top: 64, right: 160, bottom: 12, left: 160 },
  onCurveClick,
}: SankeyChartProps) {
  const { graph, enabledColumns, hueMap } = useSankeyRenderContext();
  const [hoveredSourceName, setHoveredSourceName] = useState<string>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const firstColumnId = enabledColumns[0]?.id;
  const total = graph.links.reduce(
    (sum, link) => (link.sourceNode.column.id === firstColumnId ? sum + link.value : sum),
    0,
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setContainerWidth(element.offsetWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const maxLabelWidth = getMaxLabelWidth(containerWidth, enabledColumns.length, margin);

  return (
    <div ref={containerRef} className={cn('min-w-0', className)}>
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
            <RechartsSankey
              data={graph}
              nodeWidth={NODE_WIDTH}
              nodePadding={56}
              margin={margin}
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
                    total={total}
                    showColumnLabel={showColumnLabel}
                    maxLabelWidth={maxLabelWidth}
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

function getMaxLabelWidth(
  containerWidth: number,
  columnCount: number,
  margin: ComponentProps<typeof RechartsSankey>['margin'],
): number {
  if (containerWidth <= 0 || columnCount < 2) return Number.POSITIVE_INFINITY;
  const marginLeft = typeof margin?.left === 'number' ? margin.left : 0;
  const marginRight = typeof margin?.right === 'number' ? margin.right : 0;
  const plotWidth = containerWidth - marginLeft - marginRight - NODE_WIDTH;
  const columnGap = plotWidth / (columnCount - 1);
  return Math.max(0, columnGap - LABEL_HORIZONTAL_GUTTER);
}

type SankeyNodeProps = SankeyNodeRendererProps & {
  hueMap: Record<string, number>;
  columnLabel?: string;
  total: number;
  showColumnLabel: boolean;
  maxLabelWidth: number;
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
  total,
  showColumnLabel,
  maxLabelWidth,
  onHoverChange,
}: SankeyNodeProps) {
  const name = typeof payload.name === 'string' || typeof payload.name === 'number' ? String(payload.name) : '';
  const numericValue = typeof payload.value === 'number' ? payload.value : Number(payload.value);
  const value = Number.isFinite(numericValue) ? String(numericValue) : '';
  const percentage = total > 0 && Number.isFinite(numericValue) ? Math.round((numericValue / total) * 100) : 0;
  const labelX = x + width / 2;
  const columnLabelX = x + width / 2;
  const hue = hueMap[name] ?? 0;
  const nameLabel = truncateSankeyLabel(name, NAME_LABEL_FONT_SIZE, maxLabelWidth);
  const columnHeader = columnLabel
    ? truncateSankeyLabel(columnLabel, COLUMN_LABEL_FONT_SIZE, maxLabelWidth)
    : undefined;

  return (
    <g onMouseEnter={() => onHoverChange(name)} onMouseLeave={() => onHoverChange(undefined)}>
      {showColumnLabel && columnHeader ? (
        <text x={columnLabelX} y={18} textAnchor="middle" fill={nodeColor(hue)} fontSize={12} fontWeight={600}>
          {columnHeader.truncated ? <title>{columnLabel}</title> : null}
          {columnHeader.text}
        </text>
      ) : null}
      <rect x={x} y={y} width={width} height={height} rx={3} fill={nodeColor(hue)} />
      <text
        x={labelX}
        y={y - 24}
        textAnchor="middle"
        fill={Colors.neutral5}
        fontSize={11}
        fontFamily="var(--font-mono)"
      >
        {nameLabel.truncated ? <title>{name}</title> : null}
        {nameLabel.text}
      </text>
      <text x={labelX} y={y - 8} textAnchor="middle" fill={Colors.neutral3} fontSize={9.5}>
        {value} ({percentage}%)
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
