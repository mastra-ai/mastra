'use client';

import { format, formatDate, isValid } from 'date-fns';
import { CalendarIcon, CircleAlertIcon } from 'lucide-react';
import * as React from 'react';
import type { DayPickerSingleProps } from 'react-day-picker';
import { useDebouncedCallback } from 'use-debounce';

import { Button } from '../buttons';
import { DatePicker } from './date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';
import { cn } from '@/lib/utils';
import { TimePicker } from './time-picker';
import { InputField } from '../form-fields';

type CommonProps = Omit<DayPickerSingleProps, 'mode' | 'selected' | 'onSelect'> & {
  value: Date | undefined | null;
  minValue?: Date | null;
  maxValue?: Date | null;
  defaultTimeStrValue?: string;
  onValueChange: (date: Date | undefined) => void;
};

export type DateTimePickerProps =
  | (CommonProps & { children?: never; className?: string; placeholder?: string })
  | (CommonProps & { children: React.ReactNode; className?: never; placeholder?: string });

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  minValue,
  maxValue,
  defaultTimeStrValue,
  onValueChange,
  children,
  className,
  placeholder,
  ...props
}) => {
  const [openPopover, setOpenPopover] = React.useState(false);

  return (
    <Popover open={openPopover} onOpenChange={setOpenPopover}>
      <PopoverTrigger asChild>
        {children ? (
          children
        ) : (
          <DefaultTrigger
            value={value}
            placeholder={placeholder}
            className={className}
            data-testid="datepicker-button"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        className="backdrop-blur-4xl w-auto !p-0 bg-surface4 max-w-[16.5rem]"
        align="start"
        data-testid="datepicker-calendar"
      >
        <DateTimePickerContent
          value={value}
          minValue={minValue}
          maxValue={maxValue}
          onValueChange={onValueChange}
          setOpenPopover={setOpenPopover}
          defaultTimeStrValue={defaultTimeStrValue}
          {...props}
        />
      </PopoverContent>
    </Popover>
  );
};

function getCompoundDate({ date, timeStr = '' }: { date: Date; timeStr?: string }): Date | null {
  if (!isValid(date)) {
    return null;
  }

  if (timeStr) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const newDate = new Date(`${dateStr} ${timeStr}`);
    if (isValid(newDate)) {
      return newDate;
    }
  }

  return date;
}

export const DateTimePickerContent = ({
  value,
  minValue,
  maxValue,
  onValueChange,
  setOpenPopover,
  placeholder,
  className,
  defaultTimeStrValue,
  ...props
}: CommonProps & {
  setOpenPopover?: (open: boolean) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [localErrorMsg, setLocalErrorMsg] = React.useState<string | null>(null);
  const [dateInputValue, setDateInputValue] = React.useState<string>(
    value ? format(getCompoundDate({ date: value, timeStr: defaultTimeStrValue }) || '', 'PP p') : '',
  );
  const [timeStrValue, setTimeStrValue] = React.useState<string>(defaultTimeStrValue || '');
  const [selected, setSelected] = React.useState<Date | undefined>(value ? new Date(value) : undefined);

  const debouncedDateUpdate = useDebouncedCallback((date: Date) => {
    if (isValid(date)) {
      setSelected(date);
      onValueChange?.(date);
      setOpenPopover?.(false);
    }
  }, 500);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    setDateInputValue(e.currentTarget.value);
    const date = new Date(e.currentTarget.value);
    debouncedDateUpdate(date);
  };

  const updateInputValue = (date: Date | string) => {
    if (isValid(date)) {
      if (maxValue && date > maxValue) {
        setLocalErrorMsg(`The selected date should be before ${format(maxValue, 'PP p')}`);
        setDateInputValue('');
      } else if (minValue && date < minValue) {
        setLocalErrorMsg(`The selected date should be after ${format(minValue, 'PP p')}`);
        setDateInputValue('');
      } else {
        setDateInputValue(format(date, 'PP p'));
        setLocalErrorMsg('');
      }
    } else {
      setDateInputValue('');
      setLocalErrorMsg('');
    }
  };

  const dateInputValueDate = new Date(dateInputValue);
  const dateInputValueIsValid = isValid(dateInputValueDate);
  const newValueDefined = dateInputValueIsValid && dateInputValueDate.getTime() !== value?.getTime();

  const handleDaySelect = (date: Date | undefined) => {
    setSelected(date);
    if (date) {
      const newDate = getCompoundDate({ date, timeStr: timeStrValue });
      updateInputValue(newDate || '');
    } else {
      updateInputValue('');
    }
  };

  const handleMonthSelect = (date: Date | undefined) => {
    setSelected(date);
    if (date) {
      const newDate = getCompoundDate({ date, timeStr: timeStrValue });
      updateInputValue(newDate || '');
    } else {
      updateInputValue('');
    }
  };

  const handleTimeStrChange = (val: string) => {
    setTimeStrValue(val);

    if (dateInputValueIsValid) {
      const newDate = getCompoundDate({ date: dateInputValueDate, timeStr: val });
      updateInputValue(newDate || '');
    }
  };

  const handleCancel = () => {
    setOpenPopover?.(false);
  };

  const handleApply = () => {
    if (isValid(dateInputValueDate)) {
      onValueChange(dateInputValueDate);
    }
    setOpenPopover?.(false);
  };

  const handleClear = () => {
    onValueChange(undefined);
    setSelected(undefined);
    setDateInputValue('');
    setTimeStrValue('');
    setOpenPopover?.(false);
  };

  return (
    <div
      aria-label="Choose date"
      className={cn('relative flex flex-col', className)}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          setOpenPopover?.(false);
        }
      }}
    >
      <InputField
        type="text"
        value={dateInputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="m-4 mb-0 !w-auto"
      />

      {localErrorMsg && (
        <div
          className={cn(
            'text-[0.875rem] m-[1rem] mb-0 text-icon3',
            '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:mt-[0.2em] [&>svg]:text-red-500 [&>svg]:float-left [&>svg]:mr-[0.5rem]',
          )}
        >
          <CircleAlertIcon /> {localErrorMsg}
        </div>
      )}

      <DatePicker
        mode="single"
        month={selected}
        selected={selected}
        onMonthChange={handleMonthSelect}
        onSelect={handleDaySelect}
        {...props}
      />

      <TimePicker
        onValueChange={handleTimeStrChange}
        className="m-4 mt-0 w-auto"
        defaultValue={value ? formatDate(new Date(value), 'hh:mm a') : defaultTimeStrValue}
      />

      <div className="grid grid-cols-[1fr_auto] gap-[0.5rem] m-4 mt-0">
        <Button
          variant="primary"
          tabIndex={0}
          onClick={() => {
            dateInputValueIsValid ? handleApply() : handleCancel();
          }}
        >
          {newValueDefined ? `Apply` : `Cancel`}
        </Button>
        {newValueDefined && (
          <Button variant="outline" tabIndex={0} onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

type DefaultButtonProps = {
  className?: string;
  placeholder?: string;
  value: Date | undefined | null;
};

export const DefaultTrigger = React.forwardRef<HTMLButtonElement, DefaultButtonProps>(
  ({ value, placeholder, className, ...props }, ref) => {
    return (
      <Button ref={ref} variant={'outline'} className={cn('justify-start', className)} {...props}>
        <CalendarIcon className="h-4 w-4" />
        {value ? (
          <span className="text-white">{format(value, 'PP p')}</span>
        ) : (
          <span className="text-gray">{placeholder ?? 'Pick a date'}</span>
        )}
      </Button>
    );
  },
);
