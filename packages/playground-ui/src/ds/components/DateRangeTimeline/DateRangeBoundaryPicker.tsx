import { format } from 'date-fns';
import { CalendarDaysIcon } from 'lucide-react';
import { useState } from 'react';
import { parseDate } from './lib/date-range-timeline';
import type { DateBoundary } from './lib/date-range-timeline';
import { Button } from '@/ds/components/Button/Button';
import { DatePicker } from '@/ds/components/DateTimePicker';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover/popover';
import { Txt } from '@/ds/components/Txt/Txt';

interface DateRangeBoundaryPickerProps {
  boundary: DateBoundary;
  value: string;
  min: string;
  max: string;
  onSelect: (boundary: DateBoundary, value: string) => void;
}

export function DateRangeBoundaryPicker({ boundary, value, min, max, onSelect }: DateRangeBoundaryPickerProps) {
  const [open, setOpen] = useState(false);
  const isFrom = boundary === 'from';
  const boundaryLabel = isFrom ? 'start date' : 'end date';
  const selectedDate = parseDate(value);
  const firstDate = parseDate(min) ?? selectedDate;
  const lastDate = parseDate(max) ?? selectedDate;
  const formattedDate = selectedDate ? format(selectedDate, 'MMM d, yyyy') : value;

  function handleSelect(date?: Date) {
    if (!date) return;
    onSelect(boundary, format(date, 'yyyy-MM-dd'));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Choose ${boundaryLabel}, ${formattedDate}`}
            aria-expanded={open}
            size="xs"
            className="h-11 w-full min-w-0 justify-between gap-2 overflow-hidden px-3 sm:h-8"
          >
            <Txt as="span" variant="ui-sm" className="truncate text-neutral5 tabular-nums">
              {formattedDate}
            </Txt>
            <CalendarDaysIcon className="size-3.5 shrink-0 text-neutral3" aria-hidden="true" />
          </Button>
        }
      />
      <PopoverContent align={isFrom ? 'start' : 'end'} className="w-auto p-0" sideOffset={6}>
        <DatePicker
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          fromMonth={firstDate}
          toMonth={lastDate}
          disabled={firstDate && lastDate ? { before: firstDate, after: lastDate } : undefined}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
