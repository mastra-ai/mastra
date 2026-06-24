import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { ScatterPlotChartTooltip } from './scatter-plot-chart-tooltip';
import { Colors } from '@/ds/tokens';
import { cn } from '@/lib/utils';

const LABEL_COLOR = '#a1a1aa';
const DEFAULT_POINT_SIZE = 48;
const CHART_MARGIN = { top: 16, right: 16, bottom: 16, left: 16 };

export type ScatterPlotChartDomain = [number | 'auto', number | 'auto'];
export type ScatterPlotChartFormatter = (value: unknown, point: Record<string, unknown>) => string;
export type ScatterPlotChartPointClickHandler = (point: Record<string, unknown>) => void;

export type ScatterPlotChartProps = {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  nameKey?: string;
  colorKey?: string;
  height?: React.CSSProperties['height'];
  xLabel?: string;
  yLabel?: string;
  xDomain?: ScatterPlotChartDomain;
  yDomain?: ScatterPlotChartDomain;
  formatX?: ScatterPlotChartFormatter;
  formatY?: ScatterPlotChartFormatter;
  formatTooltipLabel?: (point: Record<string, unknown>) => string;
  onPointClick?: ScatterPlotChartPointClickHandler;
  className?: string;
};

export function getScatterPlotPointColor(point: Record<string, unknown>, colorKey?: string) {
  const color = colorKey ? point[colorKey] : undefined;
  return typeof color === 'string' && color.length > 0 ? color : Colors.accent3;
}

export function getScatterPlotClickedPoint(payload: unknown) {
  return (payload as { payload?: Record<string, unknown> } | undefined)?.payload;
}

export function formatScatterPlotAxisTick(value: unknown, formatter?: ScatterPlotChartFormatter) {
  return (formatter?.(value, {}) ?? String(value)).replace(/\s+/g, '\u00A0');
}

export function ScatterPlotChart({
  data,
  xKey,
  yKey,
  nameKey,
  colorKey,
  height = 210,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  formatX,
  formatY,
  formatTooltipLabel,
  onPointClick,
  className,
}: ScatterPlotChartProps) {
  const isClickable = typeof onPointClick === 'function';
  const fillsContainer = height === '100%';

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-border1 text-ui-sm text-neutral3',
          className,
        )}
        style={{ height }}
      >
        No data to display
      </div>
    );
  }

  return (
    <div className={cn(fillsContainer && 'flex h-full min-h-0 flex-col', className)}>
      <div className={cn(fillsContainer && 'min-h-0 flex-1')} style={{ height: fillsContainer ? undefined : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid stroke={Colors.neutral3} strokeDasharray="4 4" strokeOpacity={0.18} vertical={false} />
            <XAxis
              dataKey={xKey}
              name={xLabel}
              type="number"
              tick={{ fontSize: 10, fill: LABEL_COLOR, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              domain={xDomain}
              tickFormatter={value => formatScatterPlotAxisTick(value, formatX)}
            />
            <YAxis
              dataKey={yKey}
              name={yLabel}
              type="number"
              tick={{ fontSize: 10, fill: LABEL_COLOR, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={yDomain}
              tickFormatter={value => formatScatterPlotAxisTick(value, formatY)}
            />
            <ZAxis range={[DEFAULT_POINT_SIZE, DEFAULT_POINT_SIZE]} />
            <Tooltip
              cursor={{ stroke: Colors.neutral3, strokeOpacity: 0.16 }}
              content={
                <ScatterPlotChartTooltip
                  xKey={xKey}
                  yKey={yKey}
                  nameKey={nameKey}
                  formatX={formatX}
                  formatY={formatY}
                  formatTooltipLabel={formatTooltipLabel}
                />
              }
            />
            <Scatter
              data={data}
              fill={Colors.accent3}
              shape={(props: unknown) => {
                const point = (props as { payload?: Record<string, unknown> }).payload ?? {};
                const cx = (props as { cx?: number }).cx;
                const cy = (props as { cy?: number }).cy;
                if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={getScatterPlotPointColor(point, colorKey)}
                    opacity={0.9}
                    style={{ cursor: isClickable ? 'pointer' : undefined }}
                  />
                );
              }}
              onClick={(_: unknown, payload: unknown) => {
                const point = getScatterPlotClickedPoint(payload);
                if (point) onPointClick?.(point);
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
