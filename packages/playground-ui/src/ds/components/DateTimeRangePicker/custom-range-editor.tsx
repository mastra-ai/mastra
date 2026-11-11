import { differenceInCalendarMonths, format, isValid, parse, startOfDay, subMonths } from 'date-fns';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { useId, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/ds/components/Button/Button';
import { DatePicker } from '@/ds/components/DateTimePicker';
import { Field, FieldError } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Txt } from '@/ds/components/Txt';

function formatDays(ms: number): string {
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** The draft day at the draft `HH:mm` time, or the start of the day when the time doesn't parse. */
function combineDateAndTime(date: Date | undefined, timeStr: string): Date | undefined {
  if (!date) return undefined;
  const combined = parse(timeStr, 'HH:mm', startOfDay(date));
  return isValid(combined) ? combined : startOfDay(date);
}

const isTime = (timeStr: string) => isValid(parse(timeStr, 'HH:mm', new Date()));

/** Why the drafts can't be applied, or `undefined` when they can. */
function rangeProblem({
  from,
  to,
  timesFilled,
  maxRangeMs = Infinity,
  firstDay,
}: {
  from: Date | undefined;
  to: Date | undefined;
  timesFilled: boolean;
  maxRangeMs?: number;
  firstDay: Date | undefined;
}): string | undefined {
  if (!timesFilled) return 'Enter a time for the start and end';
  if (from && to && from > to) return 'Start date/time must be before end date/time';
  if (from && to && to.getTime() - from.getTime() > maxRangeMs)
    return `Range cannot be longer than ${formatDays(maxRangeMs)}`;
  if (from && firstDay && from < firstDay) return `Range cannot start before ${format(firstDay, 'MMM d, yyyy')}`;
  return undefined;
}

/** The left month of the two: the start's month when the range spans months, else the month before the end. */
function firstShownMonth(from: Date | undefined, to: Date | undefined): Date | undefined {
  if (from && to && differenceInCalendarMonths(to, from) >= 1) return from;
  if (to) return subMonths(to, 1);
  return from;
}

export interface CustomRangeEditorProps {
  dateFrom?: Date;
  dateTo?: Date;
  disabled?: boolean;
  /** Widest range that can be applied, in milliseconds. */
  maxRangeMs?: number;
  /** Earliest day a range can start on. Days before it are disabled. */
  minDate?: Date;
  onApply: (from: Date | undefined, to: Date | undefined) => void;
  onShowPresets: () => void;
}

/**
 * The custom range popover body: one two-month calendar where the first click picks the
 * start and the second the end, with both ends and their times under it. It mounts each time the
 * popover opens, so its drafts start from the current range.
 */
export function CustomRangeEditor({
  dateFrom,
  dateTo,
  disabled,
  maxRangeMs,
  minDate,
  onApply,
  onShowPresets,
}: CustomRangeEditorProps) {
  const [range, setRange] = useState<DateRange | undefined>(
    dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined,
  );
  const [draftTimeFrom, setDraftTimeFrom] = useState(dateFrom ? format(dateFrom, 'HH:mm') : '00:00');
  const [draftTimeTo, setDraftTimeTo] = useState(dateTo ? format(dateTo, 'HH:mm') : '23:59');
  const [applyAttempted, setApplyAttempted] = useState(false);
  const errorId = useId();

  const fromDate = combineDateAndTime(range?.from, draftTimeFrom);
  const toDate = combineDateAndTime(range?.to, draftTimeTo);
  const firstDay = minDate ? startOfDay(minDate) : undefined;
  // A cleared time field would otherwise apply that end at midnight without saying so.
  const timesFilled = (!range?.from || isTime(draftTimeFrom)) && (!range?.to || isTime(draftTimeTo));
  const problem = rangeProblem({ from: fromDate, to: toDate, timesFilled, maxRangeMs, firstDay });
  // Shown after a failed Apply, and gone as soon as the drafts form a valid range again.
  const error = applyAttempted ? problem : undefined;

  const apply = () => {
    if (problem) {
      setApplyAttempted(true);
      return;
    }
    onApply(fromDate, toDate);
  };

  return (
    <div className="flex flex-col">
      <div
        role="group"
        aria-label="Custom date range"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <DatePicker
          mode="range"
          numberOfMonths={2}
          // Side by side, a month's spill-over days repeat its neighbour's, range and all.
          showOutsideDays={false}
          resetOnSelect
          selected={range}
          onSelect={setRange}
          defaultMonth={firstShownMonth(dateFrom, dateTo)}
          disabled={disabled || (firstDay ? { before: firstDay } : undefined)}
          startMonth={firstDay}
        />
        {/* Start and end share one grid: labels on the first row, values on the second, so
          the arrow centres on the values whatever the labels do. */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-1 px-3 pb-3">
          <RangeEnd
            label="Start"
            date={range?.from}
            time={draftTimeFrom}
            onTimeChange={setDraftTimeFrom}
            disabled={disabled}
          />
          <ArrowRight aria-hidden className="col-start-2 row-start-2 size-4 self-center text-muted-foreground" />
          <RangeEnd label="End" date={range?.to} time={draftTimeTo} onTimeChange={setDraftTimeTo} disabled={disabled} />
        </div>
      </div>
      <Field invalid={Boolean(error)}>
        <FieldError id={errorId} className="px-4 pb-1">
          {error}
        </FieldError>
      </Field>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <Button icon={<ChevronLeft />} variant="ghost" size="sm" disabled={disabled} onClick={onShowPresets}>
          Presets
        </Button>
        <Button className="ml-auto" icon={<Check />} variant="primary" size="sm" onClick={apply} disabled={disabled}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function RangeEnd({
  label,
  date,
  time,
  onTimeChange,
  disabled,
}: {
  label: string;
  date: Date | undefined;
  time: string;
  onTimeChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="row-span-2 grid min-w-0 grid-rows-subgrid">
      <Txt as="span" variant="column" tone="muted" className="px-1">
        {label}
      </Txt>
      <div className="flex items-center gap-1">
        <Txt as="span" variant="label" tone={date ? undefined : 'muted'} className="min-w-0 flex-1 truncate px-1">
          {date ? format(date, 'MMM d, yyyy') : 'Select a day'}
        </Txt>
        <Input
          type="time"
          size="sm"
          aria-label={`${label} time`}
          value={time}
          onChange={e => onTimeChange(e.target.value)}
          disabled={disabled}
          className="w-24 shrink-0"
        />
      </div>
    </div>
  );
}
