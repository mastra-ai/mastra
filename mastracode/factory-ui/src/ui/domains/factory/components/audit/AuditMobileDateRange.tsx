import { Button } from '@mastra/playground-ui/components/Button';
import { DateTimePicker } from '@mastra/playground-ui/components/DateTimePicker';

interface TimeRange {
  from: number;
  to: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function dateLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AuditMobileDateRange({
  bounds,
  range,
  onRangeChange,
}: {
  bounds: TimeRange;
  range: TimeRange | undefined;
  onRangeChange: (range: TimeRange | undefined) => void;
}) {
  const value = range ?? bounds;
  const minValue = new Date(bounds.from);
  const maxValue = new Date(bounds.to);

  return (
    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 lg:hidden">
      <DateTimePicker
        value={new Date(value.from)}
        minValue={minValue}
        maxValue={maxValue}
        onValueChange={date => {
          if (!date) return;
          const from = clamp(date.getTime(), bounds.from, bounds.to);
          onRangeChange({ from, to: Math.max(from, value.to) });
        }}
      >
        <Button
          type="button"
          variant="default"
          size="xs"
          aria-label="Start date"
          className="w-full min-w-0 justify-start"
        >
          <span className="truncate">Start · {dateLabel(value.from)}</span>
        </Button>
      </DateTimePicker>
      <span className="text-ui-xs text-neutral2">to</span>
      <DateTimePicker
        value={new Date(value.to)}
        minValue={minValue}
        maxValue={maxValue}
        onValueChange={date => {
          if (!date) return;
          const to = clamp(date.getTime(), bounds.from, bounds.to);
          onRangeChange({ from: Math.min(value.from, to), to });
        }}
      >
        <Button
          type="button"
          variant="default"
          size="xs"
          aria-label="End date"
          className="w-full min-w-0 justify-start"
        >
          <span className="truncate">End · {dateLabel(value.to)}</span>
        </Button>
      </DateTimePicker>
    </div>
  );
}
