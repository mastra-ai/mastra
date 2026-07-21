import { useState } from 'react';
import type { ComponentProps, CSSProperties, KeyboardEvent } from 'react';
import { ResponsiveContainer, Sankey as RechartsSankey } from 'recharts';
import { getSankeyChartCurveSelection } from './sankey-chart-utils';
import type { SankeyChartCurveSelection } from './sankey-chart-utils';
import { useSankeyRenderContext } from './sankey-context';
import { nodeColor, nodeColorVivid } from './sankeyColor';
import { Colors } from '@/ds/tokens';
import { cn } from '@/lib/utils';

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
  const firstColumnId = enabledColumns[0]?.id;
  const total = graph.links.reduce(
    (sum, link) => (link.sourceNode.column.id === firstColumnId ? sum + link.value : sum),
    0,
  );

  return (
    <div className={cn('min-w-0', className)}>
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
              nodeWidth={7}
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
                    label={node?.label}
                    total={total}
                    showColumnLabel={showColumnLabel}
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
  label?: string;
  total: number;
  showColumnLabel: boolean;
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
  label,
  total,
  showColumnLabel,
  onHoverChange,
}: SankeyNodeProps) {
  const name = typeof payload.name === 'string' || typeof payload.name === 'number' ? String(payload.name) : '';
  const displayLabel = label ?? name;
  const numericValue = typeof payload.value === 'number' ? payload.value : Number(payload.value);
  const value = Number.isFinite(numericValue) ? String(numericValue) : '';
  const percentage = total > 0 && Number.isFinite(numericValue) ? Math.round((numericValue / total) * 100) : 0;
  const labelX = x + width / 2;
  const columnLabelX = x + width / 2;
  const hue = hueMap[name] ?? 0;

  return (
    <g onMouseEnter={() => onHoverChange(name)} onMouseLeave={() => onHoverChange(undefined)}>
      {showColumnLabel && columnLabel ? (
        <text x={columnLabelX} y={18} textAnchor="middle" fill={nodeColor(hue)} fontSize={12} fontWeight={600}>
          {columnLabel}
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
        {displayLabel}
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
