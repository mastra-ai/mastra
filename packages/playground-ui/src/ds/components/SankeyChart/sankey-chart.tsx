import { useId, useState } from 'react';
import type { ComponentProps, CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, Sankey as RechartsSankey } from 'recharts';
import {
  getSankeyChartCurveSelection,
  getSankeyChartNodeSelection,
  getSankeyChartNodeWeights,
  SANKEY_NODE_WIDTH,
  truncateSankeyLabel,
} from './sankey-chart-utils';
import type {
  SankeyChartColumn,
  SankeyChartCurveSelection,
  SankeyChartNodeSelection,
  SankeyLabelWidths,
} from './sankey-chart-utils';
import { useSankeyRenderContext } from './sankey-context';
import { nodeColor, nodeColorVivid } from './sankeyColor';
import { useSankeyChartMeasurements } from './use-sankey-chart-measurements';
import { Colors } from '@/ds/tokens';
import { cn } from '@/lib/utils';

const NODE_LABEL_FONT_SIZE = 11;
const COLUMN_LABEL_FONT_SIZE = 12;
// pre-measurement cap, kept so wide charts read unchanged
const NODE_LABEL_MAX_CHARACTERS = 23;

export type SankeyChartProps = {
  height?: CSSProperties['height'];
  className?: string;
  margin?: ComponentProps<typeof RechartsSankey>['margin'];
  onCurveClick?: (selection: SankeyChartCurveSelection) => void;
  onNodeClick?: (selection: SankeyChartNodeSelection) => void;
  isNodeClickable?: (selection: SankeyChartNodeSelection) => boolean;
  getColumnDescription?: (column: SankeyChartColumn) => string | undefined;
  /** Suppress the built-in SVG column headers when the caller renders its own header row. */
  hideColumnLabels?: boolean;
};

export function SankeyChart({
  height = 320,
  className,
  margin = { top: 64, right: 160, bottom: 12, left: 160 },
  onCurveClick,
  onNodeClick,
  isNodeClickable,
  getColumnDescription,
  hideColumnLabels = false,
}: SankeyChartProps) {
  const { graph, enabledColumns, hueMap, usesFixedGeometry } = useSankeyRenderContext();
  const { chartContainerRef, fixedGeometry, labelWidths } = useSankeyChartMeasurements({
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
  // Each node's percentage is its share of its own column, so later columns
  // with more counted traces than the first column never exceed 100%.
  const columnTotals = new Map<string, number>();
  for (const node of graph.nodes) {
    const nodeValue = node.displayValue ?? nodeWeights.get(node.id) ?? 0;
    columnTotals.set(node.column.id, (columnTotals.get(node.column.id) ?? 0) + nodeValue);
  }

  return (
    <div className={cn('min-w-0', className)}>
      {graph.links.length === 0 ? (
        <div
          className="border-border1 text-ui-sm text-neutral3 flex items-center justify-center rounded-md border"
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
              nodeWidth={SANKEY_NODE_WIDTH}
              nodePadding={56}
              margin={margin}
              node={(props: SankeyNodeRendererProps) => {
                const node = graph.nodes[props.index];
                const showColumnLabel =
                  !hideColumnLabels && node
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
                    columnDescription={node ? getColumnDescription?.(node.column) : undefined}
                    label={node?.label}
                    nodeValue={node?.displayValue}
                    layoutValue={nodeGeometry ? undefined : node ? nodeWeights.get(node.id) : undefined}
                    columnTotal={node ? (columnTotals.get(node.column.id) ?? 0) : 0}
                    showColumnLabel={showColumnLabel}
                    isFirstColumn={node?.column.id === firstColumnId}
                    isLastColumn={node?.column.id === lastColumnId}
                    labelWidths={labelWidths}
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
                const sourceX = linkGeometry?.sourceX ?? props.sourceX;
                const targetX = linkGeometry?.targetX ?? props.targetX;
                const fixedControlX = linkGeometry ? (sourceX + targetX) / 2 : undefined;
                return (
                  <SankeyLink
                    {...props}
                    sourceX={sourceX}
                    targetX={targetX}
                    sourceControlX={fixedControlX ?? props.sourceControlX}
                    targetControlX={fixedControlX ?? props.targetControlX}
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
  columnDescription?: string;
  label?: string;
  nodeValue?: number;
  layoutValue?: number;
  columnTotal: number;
  showColumnLabel: boolean;
  isFirstColumn: boolean;
  isLastColumn: boolean;
  labelWidths: SankeyLabelWidths;
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
  columnDescription,
  label,
  nodeValue,
  layoutValue,
  columnTotal,
  showColumnLabel,
  isFirstColumn,
  isLastColumn,
  labelWidths,
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
  const nodeLabelWidth = isFirstColumn || isLastColumn ? labelWidths.edge : labelWidths.centered;
  const visibleLabel = truncateSankeyLabel(visibleDisplayLabel, {
    fontSize: NODE_LABEL_FONT_SIZE,
    maxWidth: nodeLabelWidth,
    maxCharacters: NODE_LABEL_MAX_CHARACTERS,
  });
  const visibleColumnLabel = columnLabel
    ? truncateSankeyLabel(columnLabel, { fontSize: COLUMN_LABEL_FONT_SIZE, maxWidth: nodeLabelWidth })
    : undefined;
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
  const percentage =
    columnTotal > 0 && Number.isFinite(numericValue) ? Math.round((numericValue / columnTotal) * 100) : 0;
  const visibleHeight = scaleSankeyDimension(height, numericValue, layoutValue);
  const visibleY = y + (height - visibleHeight) / 2;
  const textAnchor = isFirstColumn ? 'start' : isLastColumn ? 'end' : 'middle';
  const labelX = isFirstColumn ? x : isLastColumn ? x + width : x + width / 2;
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
      {/* Rendered outside the interactive group so hovering the header never opens a theme tooltip. */}
      {showColumnLabel && visibleColumnLabel && columnLabel ? (
        <SankeyColumnHeader
          x={labelX}
          textAnchor={textAnchor}
          fill={nodeColor(hue)}
          label={visibleColumnLabel}
          fullLabel={columnLabel}
          description={columnDescription}
        />
      ) : null}
      <g
        aria-describedby={description ? tooltipId : undefined}
        aria-label={`${accessibleLabel}: ${value} ${numericValue === 1 ? 'trace' : 'traces'} (${percentage}%)`}
        className="focus-visible:[&>rect]:stroke-neutral6 outline-hidden focus-visible:[&>rect]:stroke-2"
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
        {/* The custom tooltip covers described nodes; a native title there would stack a second popup. */}
        {description ? null : <title>{displayLabel}</title>}
        <rect x={x} y={visibleY} width={width} height={visibleHeight} rx={3} fill={nodeColor(hue)} />
        <text
          x={labelX}
          y={y - 24}
          textAnchor={textAnchor}
          fill={Colors.neutral5}
          fontSize={NODE_LABEL_FONT_SIZE}
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
              className="border-border1 bg-surface5 text-neutral6 shadow-elevated pointer-events-none fixed z-50 rounded-md border p-2 text-xs leading-4"
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
              <div className="text-neutral4 whitespace-pre-wrap">{description}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Column header text. Inert for node tooltips, but when the caller supplies a
 * column description it opens its own portal tooltip on hover or focus.
 */
function SankeyColumnHeader({
  x,
  textAnchor,
  fill,
  label,
  fullLabel,
  description,
}: {
  x: number;
  textAnchor: 'start' | 'middle' | 'end';
  fill: string;
  label: string;
  fullLabel: string;
  description?: string;
}) {
  const tooltipId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
    placement: 'above' | 'below';
  }>();
  const isTooltipVisible = Boolean(description && tooltipPosition && (isHovered || isFocused));
  const showTooltipAt = (target: SVGTextElement) => {
    const rect = target.getBoundingClientRect();
    const placement = rect.top < 120 ? 'below' : 'above';
    setTooltipPosition({
      left: Math.min(Math.max(rect.left, 16), Math.max(window.innerWidth - 336, 16)),
      top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  };

  return (
    <>
      <text
        aria-describedby={description ? tooltipId : undefined}
        x={x}
        y={18}
        textAnchor={textAnchor}
        fill={fill}
        fontSize={COLUMN_LABEL_FONT_SIZE}
        fontWeight={600}
        tabIndex={description ? 0 : undefined}
        onMouseEnter={
          description
            ? event => {
                setIsHovered(true);
                showTooltipAt(event.currentTarget);
              }
            : undefined
        }
        onMouseLeave={description ? () => setIsHovered(false) : undefined}
        onFocus={
          description
            ? event => {
                setIsFocused(true);
                showTooltipAt(event.currentTarget);
              }
            : undefined
        }
        onBlur={description ? () => setIsFocused(false) : undefined}
      >
        {/* The custom tooltip already names the column; a native title would stack a second popup. */}
        {label === fullLabel || description ? null : <title>{fullLabel}</title>}
        {label}
      </text>
      {description && isTooltipVisible && tooltipPosition
        ? createPortal(
            <div
              aria-label={`${fullLabel}: ${description}`}
              className="border-border1 bg-surface5 text-neutral6 shadow-elevated pointer-events-none fixed z-50 rounded-md border p-2 text-xs leading-4"
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
              <div className="font-medium">{fullLabel}</div>
              <div className="text-neutral4 whitespace-pre-wrap">{description}</div>
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
