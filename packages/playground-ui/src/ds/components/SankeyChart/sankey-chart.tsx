import { useId, useState } from 'react';
import type { ComponentProps, CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, Sankey as RechartsSankey } from 'recharts';
import {
  getSankeyChartCurveSelection,
  getSankeyChartNodeSelection,
  getSankeyChartNodeWeights,
} from './sankey-chart-utils';
import type { SankeyChartCurveSelection, SankeyChartNodeSelection } from './sankey-chart-utils';
import { useSankeyRenderContext } from './sankey-context';
import { nodeColor, nodeColorVivid } from './sankeyColor';
import { useSankeyChartMeasurements } from './use-sankey-chart-measurements';
import { Colors } from '@/ds/tokens';
import { cn } from '@/lib/utils';

export type SankeyChartProps = {
  height?: CSSProperties['height'];
  className?: string;
  margin?: ComponentProps<typeof RechartsSankey>['margin'];
  onCurveClick?: (selection: SankeyChartCurveSelection) => void;
  onNodeClick?: (selection: SankeyChartNodeSelection) => void;
  isNodeClickable?: (selection: SankeyChartNodeSelection) => boolean;
};

export function SankeyChart({
  height = 320,
  className,
  margin = { top: 64, right: 160, bottom: 12, left: 160 },
  onCurveClick,
  onNodeClick,
  isNodeClickable,
}: SankeyChartProps) {
  const { graph, enabledColumns, hueMap, usesFixedGeometry } = useSankeyRenderContext();
  const { chartContainerRef, fixedGeometry } = useSankeyChartMeasurements({
    graph,
    height,
    margin,
    usesFixedGeometry,
  });
  const [hoveredSourceName, setHoveredSourceName] = useState<string>();
  const [focusedSourceName, setFocusedSourceName] = useState<string>();
  const activeSourceName = hoveredSourceName ?? focusedSourceName;
  const firstColumnId = enabledColumns[0]?.id;
  const lastColumnId = enabledColumns.at(-1)?.id;
  const nodeWeights = getSankeyChartNodeWeights(graph);
  const total = graph.nodes.reduce(
    (sum, node) =>
      node.column.id === firstColumnId ? sum + (node.displayValue ?? nodeWeights.get(node.id) ?? 0) : sum,
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
        <div ref={chartContainerRef} style={{ height }}>
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
                const nodeGeometry = node ? fixedGeometry?.nodes.get(node.id) : undefined;
                const selection = node ? getSankeyChartNodeSelection(node) : undefined;
                const clickable = Boolean(
                  onNodeClick && selection && (isNodeClickable === undefined || isNodeClickable(selection)),
                );
                return (
                  <SankeyNode
                    {...props}
                    x={nodeGeometry?.x ?? props.x}
                    y={nodeGeometry?.y ?? props.y}
                    height={nodeGeometry?.height ?? props.height}
                    hueMap={hueMap}
                    columnLabel={node?.column.label}
                    label={node?.label}
                    nodeValue={node?.displayValue}
                    layoutValue={nodeGeometry ? undefined : node ? nodeWeights.get(node.id) : undefined}
                    total={total}
                    showColumnLabel={showColumnLabel}
                    isFirstColumn={node?.column.id === firstColumnId}
                    isLastColumn={node?.column.id === lastColumnId}
                    onFocusChange={setFocusedSourceName}
                    onHoverChange={setHoveredSourceName}
                    clickable={clickable}
                    onSelect={() => {
                      if (selection && clickable) onNodeClick?.(selection);
                    }}
                  />
                );
              }}
              link={(props: SankeyLinkRendererProps) => {
                const link = graph.links[props.index];
                const linkGeometry = link ? fixedGeometry?.links.get(link.id) : undefined;
                return (
                  <SankeyLink
                    {...props}
                    sourceY={linkGeometry?.sourceY ?? props.sourceY}
                    targetY={linkGeometry?.targetY ?? props.targetY}
                    sourceWidth={linkGeometry?.sourceWidth}
                    targetWidth={linkGeometry?.targetWidth}
                    hueMap={hueMap}
                    highlighted={String(props.payload.source.name ?? '') === activeSourceName}
                    displayValue={link?.displayValue}
                    layoutValue={link?.value}
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
  nodeValue?: number;
  layoutValue?: number;
  total: number;
  showColumnLabel: boolean;
  isFirstColumn: boolean;
  isLastColumn: boolean;
  clickable: boolean;
  onFocusChange: (sourceName: string | undefined) => void;
  onHoverChange: (sourceName: string | undefined) => void;
  onSelect: () => void;
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
  nodeValue,
  layoutValue,
  total,
  showColumnLabel,
  isFirstColumn,
  isLastColumn,
  clickable,
  onFocusChange,
  onHoverChange,
  onSelect,
}: SankeyNodeProps) {
  const name = typeof payload.name === 'string' || typeof payload.name === 'number' ? String(payload.name) : '';
  const displayLabel = label ?? name;
  const descriptionIndex = displayLabel.indexOf('\n');
  const visibleDisplayLabel = descriptionIndex >= 0 ? displayLabel.slice(0, descriptionIndex) : displayLabel;
  const description = descriptionIndex >= 0 ? displayLabel.slice(descriptionIndex + 1) : undefined;
  const accessibleLabel = displayLabel.replaceAll('\n', '. ');
  const visibleLabel = truncateNodeLabel(visibleDisplayLabel);
  const tooltipId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
    placement: 'above' | 'below';
  }>();
  const numericValue = nodeValue ?? (typeof payload.value === 'number' ? payload.value : Number(payload.value));
  const value = Number.isFinite(numericValue) ? String(numericValue) : '';
  const percentage = total > 0 && Number.isFinite(numericValue) ? Math.round((numericValue / total) * 100) : 0;
  const visibleHeight = scaleSankeyDimension(height, numericValue, layoutValue);
  const visibleY = y + (height - visibleHeight) / 2;
  const textAnchor = isFirstColumn ? 'start' : isLastColumn ? 'end' : 'middle';
  const labelX = isFirstColumn ? x : isLastColumn ? x + width : x + width / 2;
  const columnLabelX = x + width / 2;
  const hue = hueMap[name] ?? 0;
  const isTooltipVisible = Boolean(description && tooltipPosition && (isHovered || isFocused));
  const showTooltipAt = (target: SVGGElement) => {
    const rect = target.getBoundingClientRect();
    const placement = rect.top < 120 ? 'below' : 'above';
    setTooltipPosition({
      left: Math.min(Math.max(rect.left, 16), Math.max(window.innerWidth - 336, 16)),
      top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  };
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect();
  };

  return (
    <>
      <g
        aria-describedby={description ? tooltipId : undefined}
        aria-label={`${accessibleLabel}: ${value} ${numericValue === 1 ? 'trace' : 'traces'} (${percentage}%)`}
        className="outline-hidden focus-visible:[&>rect]:stroke-neutral6 focus-visible:[&>rect]:stroke-2"
        onClick={clickable ? onSelect : undefined}
        onKeyDown={clickable ? handleKeyDown : undefined}
        role={clickable ? 'button' : undefined}
        onFocus={event => {
          onFocusChange(name);
          setIsFocused(true);
          showTooltipAt(event.currentTarget);
        }}
        onBlur={() => {
          onFocusChange(undefined);
          setIsFocused(false);
        }}
        onMouseEnter={event => {
          onHoverChange(name);
          setIsHovered(true);
          showTooltipAt(event.currentTarget);
        }}
        onMouseLeave={() => {
          onHoverChange(undefined);
          setIsHovered(false);
        }}
        style={{ cursor: clickable ? 'pointer' : undefined }}
        tabIndex={0}
      >
        <title>{displayLabel}</title>
        {showColumnLabel && columnLabel ? (
          <text x={columnLabelX} y={18} textAnchor="middle" fill={nodeColor(hue)} fontSize={12} fontWeight={600}>
            {columnLabel}
          </text>
        ) : null}
        <rect x={x} y={visibleY} width={width} height={visibleHeight} rx={3} fill={nodeColor(hue)} />
        <text
          x={labelX}
          y={y - 24}
          textAnchor={textAnchor}
          fill={Colors.neutral5}
          fontSize={11}
          fontFamily="var(--font-mono)"
        >
          {visibleLabel}
        </text>
        <text x={labelX} y={y - 8} textAnchor={textAnchor} fill={Colors.neutral3} fontSize={9.5}>
          {value} ({percentage}%)
        </text>
      </g>
      {description && isTooltipVisible && tooltipPosition
        ? createPortal(
            <div
              aria-label={`${visibleDisplayLabel}: ${description}`}
              className="pointer-events-none fixed z-50 rounded-md border border-border1 bg-surface5 p-2 text-xs leading-4 text-neutral6 shadow-elevated"
              id={tooltipId}
              role="tooltip"
              style={{
                left: tooltipPosition.left,
                maxWidth: 'min(20rem, calc(100vw - 2rem))',
                top: tooltipPosition.top,
                transform: tooltipPosition.placement === 'above' ? 'translateY(-100%)' : undefined,
                width: 'max-content',
              }}
            >
              <div className="font-medium">{visibleDisplayLabel}</div>
              <div className="whitespace-pre-wrap text-neutral4">{description}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function scaleSankeyDimension(size: number, displayValue: number | undefined, layoutValue: number | undefined) {
  if (displayValue === undefined || layoutValue === undefined || layoutValue <= 0) return size;
  return size * Math.min(Math.max(displayValue / layoutValue, 0), 1);
}

function truncateNodeLabel(label: string) {
  const maximumLength = 23;
  if (label.length <= maximumLength) return label;
  return `${label.slice(0, maximumLength - 1).trimEnd()}…`;
}

type SankeyLinkProps = SankeyLinkRendererProps & {
  hueMap: Record<string, number>;
  highlighted: boolean;
  displayValue?: number;
  layoutValue?: number;
  sourceWidth?: number;
  targetWidth?: number;
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
  displayValue,
  layoutValue,
  sourceWidth,
  targetWidth,
  clickable,
  onHoverChange,
  onSelect,
}: SankeyLinkProps) {
  const visibleWidth = scaleSankeyDimension(linkWidth, displayValue, layoutValue);
  const sourceHalfWidth = Math.max(0, sourceWidth ?? visibleWidth) / 2;
  const targetHalfWidth = Math.max(0, targetWidth ?? visibleWidth) / 2;
  const path = [
    `M${sourceX},${sourceY - sourceHalfWidth}`,
    `C${sourceControlX},${sourceY - sourceHalfWidth} ${targetControlX},${targetY - targetHalfWidth} ${targetX},${targetY - targetHalfWidth}`,
    `L${targetX},${targetY + targetHalfWidth}`,
    `C${targetControlX},${targetY + targetHalfWidth} ${sourceControlX},${sourceY + sourceHalfWidth} ${sourceX},${sourceY + sourceHalfWidth}`,
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
