'use client';

import { format, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import type { DayPickerSingleProps } from 'react-day-picker';
import { useDebouncedCallback } from 'use-debounce';

import { Button } from '../buttons';
import { DatePicker } from './date-picker';
import { Input } from '../../input';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';
import { cn } from '@/lib/utils';
import { TimePicker } from './time-picker';

type CommonProps = Omit<DayPickerSingleProps, 'mode' | 'selected' | 'onSelect'> & {
  value: Date | undefined | null;
  defaultTimeStrValue?: string;
  onValueChange: (date: Date | undefined | null) => void;
  clearable?: boolean;
};

export type DateTimePickerProps =
  | (CommonProps & { children?: never; className?: string; placeholder?: string })
  | (CommonProps & { children: React.ReactNode; className?: never; placeholder?: string });

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  defaultTimeStrValue,
  onValueChange,
  children,
  className,
  placeholder,
  classNames,
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
        className="backdrop-blur-4xl w-auto p-0 bg-[#171717]"
        align="start"
        data-testid="datepicker-calendar"
      >
        <DateTimePickerContent
          value={value}
          onValueChange={onValueChange}
          clearable={props.clearable}
          setOpenPopover={setOpenPopover}
          defaultTimeStrValue={defaultTimeStrValue}
          {...props}
        />
      </PopoverContent>
    </Popover>
  );
};

function getCompoundDate({ date, timeStr = '' }: { date: Date; timeStr?: string }) {
  if (!isValid(date)) {
    return '';
  }

  if (timeStr) {
    const dateStr = format(date, 'yyy-MM-dd');
    const newDate = new Date(`${dateStr} ${timeStr}`);
    if (isValid(newDate)) {
      return newDate;
    }
  }

  return date;
}

export const DateTimePickerContent = ({
  value,
  onValueChange,
  setOpenPopover,
  clearable,
  placeholder,
  className,
  defaultTimeStrValue,
  ...props
}: CommonProps & {
  setOpenPopover?: (open: boolean) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [dateInputValue, setDateInputValue] = React.useState<string>(
    value ? format(getCompoundDate({ date: value, timeStr: defaultTimeStrValue }), 'PP p') : '',
  );
  const [timeValue, setTimeValue] = React.useState<string>(defaultTimeStrValue || '');
  const [selected, setSelected] = React.useState<Date | undefined>(value ? new Date(value) : undefined);

  const debouncedDateUpdate = useDebouncedCallback((date: Date) => {
    if (isValid(date)) {
      setSelected(date);
      onValueChange?.(date);
      setOpenPopover?.(false);
    }
  }, 2000);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    setDateInputValue(e.currentTarget.value);
    const date = new Date(e.target.value);
    debouncedDateUpdate(date);
  };

  const dateInputValueDate = new Date(dateInputValue);
  const dateInputValueIsValid = isValid(dateInputValueDate);
  const newValueDefined = dateInputValueIsValid && dateInputValueDate !== value;

  const handleDaySelect = (date: Date | undefined) => {
    setSelected(date);
    if (date) {
      const newDate = getCompoundDate({ date, timeStr: timeValue });
      setDateInputValue(format(newDate, 'PP p'));
    } else {
      setDateInputValue('');
    }
  };

  const handleMonthSelect = (date: Date | undefined) => {
    setSelected(date);
    if (date) {
      const newDate = getCompoundDate({ date, timeStr: timeValue });
      setDateInputValue(format(newDate, 'PP p'));
    } else {
      setDateInputValue('');
    }
  };

  const handleTimeStrChange = (val: string) => {
    setTimeValue(val);

    if (dateInputValueIsValid) {
      const newDate = getCompoundDate({ date: dateInputValueDate, timeStr: val });
      setDateInputValue(format(newDate, 'PP p'));
    }
  };

  const handleCancel = () => {
    setOpenPopover?.(false);
  };

  const handleApply = () => {
    onValueChange(dateInputValueDate);
    setOpenPopover?.(false);
  };

  const handleClear = () => {
    onValueChange(null);
    setSelected(undefined);
    setDateInputValue('');
    setTimeValue('');
    setOpenPopover?.(false);
  };

  return (
    <div
      aria-label="Choose date"
      className={cn('relative mt-2 flex flex-col', className)}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          setOpenPopover?.(false);
        }
      }}
    >
      <Input
        type="text"
        value={dateInputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="m-4 mb-0 !w-auto"
      />

      <DatePicker
        mode="single"
        month={selected}
        selected={selected}
        onMonthChange={handleMonthSelect}
        onSelect={handleDaySelect}
        {...props}
      />

      <TimePicker onValueChange={handleTimeStrChange} className="m-4 mt-0 w-auto" defaultValue={defaultTimeStrValue} />

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
          <span className="text-white">{format(value, 'PPP p')}</span>
        ) : (
          <span className="text-gray">{placeholder ?? 'Pick a date'}</span>
        )}
      </Button>
    );
  },
);
