import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ds/components/Tooltip';
import { CHART_COLORS } from './metrics-utils';
import { Txt } from '@/ds/components/Txt';

export function BarListContent({
  data,
  maxVal,
  fmt,
  color,
  valueLabel,
  legend,
}: {
  data: Array<{ name: string; value: number }>;
  maxVal: number;
  fmt: (v: number) => string;
  color: string;
  valueLabel?: string;
  legend?: Array<{ color: string; label: string }>;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-4">
          {legend?.map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
              <Txt as="span" variant="caption" tone="faint">
                {l.label}
              </Txt>
            </div>
          ))}
        </div>
        {valueLabel && (
          <Txt as="span" variant="caption" tone="faint" className="shrink-0">
            {valueLabel}
          </Txt>
        )}
      </div>
      <div className="space-y-2.5">
        {sorted.map(d => {
          const pct = Math.min(Math.max(maxVal > 0 ? (d.value / maxVal) * 100 : 0, 0), 100);
          return (
            <div key={d.name} className="group flex items-center gap-3">
              <div className="relative h-7 flex-1">
                <div
                  className="absolute inset-y-0 left-0 rounded"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
                <Txt
                  as="span"
                  variant="caption"
                  className="absolute inset-y-0 left-2 flex items-center whitespace-nowrap text-white"
                >
                  {d.name}
                </Txt>
              </div>
              <Txt as="span" variant="caption" tone="ink" className="shrink-0 tabular-nums">
                {fmt(d.value)}
              </Txt>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StackedRunsBars({ data }: { data: Array<{ name: string; completed: number; errors: number }> }) {
  const sorted = [...data].sort((a, b) => b.completed + b.errors - (a.completed + a.errors));
  const maxTotal = Math.max(...sorted.map(d => d.completed + d.errors));
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.blue }} />
            <Txt as="span" variant="caption" tone="faint">
              Completed
            </Txt>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.red }} />
            <Txt as="span" variant="caption" tone="faint">
              Errors
            </Txt>
          </div>
        </div>
        <Txt as="span" variant="caption" tone="faint" className="shrink-0">
          Total (Success)
        </Txt>
      </div>
      <div className="space-y-2.5">
        {sorted.map(d => {
          const total = d.completed + d.errors;
          const successPct = total > 0 ? ((d.completed / total) * 100).toFixed(1) : '0.0';
          const completedWidth = Math.min(Math.max(maxTotal > 0 ? (d.completed / maxTotal) * 100 : 0, 0), 100);
          const errorsWidth = Math.min(Math.max(maxTotal > 0 ? (d.errors / maxTotal) * 100 : 0, 0), 100);
          return (
            <div key={d.name} className="group flex items-center gap-3">
              <div className="relative h-7 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      role="img"
                      aria-label={`${d.completed.toLocaleString()} completed`}
                      tabIndex={0}
                      className="absolute inset-y-0 left-0 cursor-default rounded-l"
                      style={{ width: `${completedWidth}%`, backgroundColor: CHART_COLORS.blue }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">{d.completed.toLocaleString()} completed</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      role="img"
                      aria-label={`${d.errors.toLocaleString()} errors`}
                      tabIndex={0}
                      className="absolute inset-y-0 cursor-default rounded-r"
                      style={{
                        left: `${completedWidth}%`,
                        width: `${errorsWidth}%`,
                        backgroundColor: CHART_COLORS.red,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">{d.errors.toLocaleString()} errors</TooltipContent>
                </Tooltip>
                <Txt
                  as="span"
                  variant="caption"
                  className="pointer-events-none absolute inset-y-0 left-2 flex items-center whitespace-nowrap text-white"
                >
                  {d.name}
                </Txt>
              </div>
              <Txt as="span" variant="caption" tone="ink" className="shrink-0 tabular-nums">
                {total.toLocaleString()} ({successPct}%)
              </Txt>
            </div>
          );
        })}
      </div>
    </div>
  );
}
