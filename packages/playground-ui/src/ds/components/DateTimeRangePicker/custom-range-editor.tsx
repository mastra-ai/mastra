import { isValid, parse } from 'date-fns';
import { Check } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/ds/components/Button/Button';
import { DatePicker, TimePicker } from '@/ds/components/DateTimePicker';
import { Field, FieldError } from '@/ds/components/Field';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

function buildDateWithTime(date: Date, timeStr: string): Date | null {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const combined = parse(timeStr, 'h:mm a', dateOnly);
  return isValid(combined) ? combined : null;
}

export interface CustomRangeEditorProps {
  dateFrom?: Date;
  dateTo?: Date;
  disabled?: boolean;
  onApply: (from: Date | undefined, to: Date | undefined) => void;
  onShowPresets: () => void;
}

/**
 * The custom range popover body. It mounts each time the popover opens, so its drafts
 * start from the current range without the picker resetting them.
 */
export function CustomRangeEditor({ dateFrom, dateTo, disabled, onApply, onShowPresets }: CustomRangeEditorProps) {
  const [draftDateFrom, setDraftDateFrom] = useState<Date | undefined>(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState<Date | undefined>(dateTo);
  const [draftTimeFrom, setDraftTimeFrom] = useState('12:00 AM');
  const [draftTimeTo, setDraftTimeTo] = useState('11:59 PM');
  const [error, setError] = useState<string | undefined>();
  const errorId = useId();

  const apply = () => {
    const fromDate = draftDateFrom ? (buildDateWithTime(draftDateFrom, draftTimeFrom) ?? draftDateFrom) : undefined;
    const toDate = draftDateTo ? (buildDateWithTime(draftDateTo, draftTimeTo) ?? draftDateTo) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      setError('Start date/time must be before end date/time');
      return;
    }
    onApply(fromDate, toDate);
  };

  return (
    <>
      <div
        role="group"
        aria-label="Custom date range"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="flex"
      >
        <div className={cn('border-r border-border')}>
          <Txt as="span" variant="column" tone="muted" className="block px-4 pt-3">
            Start
          </Txt>
          <DatePicker
            mode="single"
            selected={draftDateFrom}
            month={draftDateFrom}
            onSelect={setDraftDateFrom}
            disabled={disabled}
            toDate={draftDateTo}
          />
          <TimePicker
            label="Start time"
            className="mx-4 mb-3 w-auto"
            defaultValue={draftTimeFrom}
            onValueChange={v => {
              if (!disabled) setDraftTimeFrom(v);
            }}
          />
        </div>
        <div>
          <Txt as="span" variant="column" tone="muted" className="block px-4 pt-3">
            End
          </Txt>
          <DatePicker
            mode="single"
            selected={draftDateTo}
            month={draftDateTo}
            onSelect={setDraftDateTo}
            disabled={disabled}
            fromDate={draftDateFrom}
          />
          <TimePicker
            label="End time"
            className="mx-4 mb-3 w-auto"
            defaultValue={draftTimeTo}
            onValueChange={v => {
              if (!disabled) setDraftTimeTo(v);
            }}
          />
        </div>
      </div>
      <Field invalid={Boolean(error)}>
        <FieldError id={errorId} className="px-4 pb-1">
          {error}
        </FieldError>
      </Field>
      <div className={cn('flex items-center justify-between px-4 pb-3')}>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onShowPresets}>
          &larr; Presets
        </Button>
        <Button icon={<Check />} variant="primary" size="sm" onClick={apply} disabled={disabled}>
          Apply
        </Button>
      </div>
    </>
  );
}
