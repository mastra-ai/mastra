import { Button } from '@mastra/playground-ui/components/Button';
import { DateTimePicker } from '@mastra/playground-ui/components/DateTimePicker';

import { auditDayEnd, auditDayStart, auditRangeBetween, clamp, type AuditTimeRange } from '../../auditPresentation';

function dateLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AuditMobileDateRange({
  bounds,
  range,
  onRangeChange,
}: {
  bounds: AuditTimeRange;
  range: AuditTimeRange | undefined;
  onRangeChange: (range: AuditTimeRange | undefined) => void;
}) {
  const value = range ?? bounds;
  const minValue = new Date(auditDayStart(new Date(bounds.from)));
  const maxValue = new Date(auditDayEnd(new Date(bounds.to)));

  return (
    <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 [@media(any-pointer:coarse)]:grid">
      <DateTimePicker
        value={new Date(value.from)}
        minValue={minValue}
        maxValue={maxValue}
        onValueChange={date => {
          if (!date) return onRangeChange(undefined);
          const from = clamp(auditDayStart(date), bounds.from, bounds.to);
          onRangeChange(auditRangeBetween(value.to, from, bounds));
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
          if (!date) return onRangeChange(undefined);
          const to = clamp(auditDayEnd(date), bounds.from, bounds.to);
          onRangeChange(auditRangeBetween(value.from, to, bounds));
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
