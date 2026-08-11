import { format } from 'date-fns';
import { parseDate } from './lib/date-range-timeline';
import type { TimelineTick } from './lib/date-range-timeline';
import { Txt } from '@/ds/components/Txt/Txt';

interface DateRangeTicksProps {
  ticks: TimelineTick[];
  min: string;
  max: string;
}

function formatBoundaryDate(value: string) {
  const date = parseDate(value);
  return date ? format(date, 'MMM d, yyyy') : value;
}

export function DateRangeTicks({ ticks, min, max }: DateRangeTicksProps) {
  const firstTick = ticks[0];
  const lastTick = ticks.at(-1);
  if (!firstTick || !lastTick) return null;
  const timelineLabel = `Visible from ${formatBoundaryDate(firstTick.date)} through ${formatBoundaryDate(lastTick.date)}. Available from ${formatBoundaryDate(min)} through ${formatBoundaryDate(max)}`;

  if (firstTick.date === lastTick.date) {
    const date = formatBoundaryDate(firstTick.date);
    // Only claim "Created today" when the whole available domain is a single
    // day; a zoomed viewport can hold one tick for any date, so stay neutral.
    const singleLabel =
      firstTick.date === min && firstTick.date === max
        ? `Created today · ${date}`
        : firstTick.date === min
          ? `Created · ${date}`
          : firstTick.date === max
            ? `Today · ${date}`
            : date;
    return (
      <div role="group" aria-label={timelineLabel} className="flex h-10 items-start justify-center pt-2">
        {/* TODO(ds): Txt needs a muted timeline-axis variant. */}
        <Txt as="span" variant="ui-sm" className="text-neutral3">
          {singleLabel}
        </Txt>
      </div>
    );
  }

  const startLabel = firstTick.date === min ? `Created · ${formatBoundaryDate(min)}` : firstTick.label;
  const endLabel = lastTick.date === max ? `Today · ${formatBoundaryDate(max)}` : lastTick.label;
  const middleTicks = ticks.slice(1, -1);

  return (
    <div role="group" className="relative h-10" aria-label={timelineLabel}>
      <div className="absolute top-0 left-0 flex flex-col items-start">
        <span className="bg-border2 mb-1 h-1.5 w-px" aria-hidden="true" />
        {/* TODO(ds): Txt needs a muted timeline-axis variant. */}
        <Txt as="span" variant="ui-sm" className="text-neutral3 whitespace-nowrap">
          {startLabel}
        </Txt>
      </div>

      {middleTicks.map(tick => (
        <div
          key={tick.date}
          className="absolute top-0 hidden -translate-x-1/2 flex-col items-center sm:flex"
          style={{ left: `${tick.position}%` }}
          aria-hidden="true"
        >
          <span className="bg-border2 mb-1 h-1.5 w-px" />
          {/* TODO(ds): Txt needs a muted timeline-axis variant. */}
          <Txt as="span" variant="ui-xs" className="text-neutral3 whitespace-nowrap">
            {tick.label}
          </Txt>
        </div>
      ))}

      <div className="absolute top-0 right-0 flex flex-col items-end">
        <span className="bg-border2 mb-1 h-1.5 w-px" aria-hidden="true" />
        {/* TODO(ds): Txt needs a muted timeline-axis variant. */}
        <Txt as="span" variant="ui-sm" className="text-neutral3 whitespace-nowrap">
          {endLabel}
        </Txt>
      </div>
    </div>
  );
}
