'use client';

import { format, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import type { PropsSingle } from 'react-day-picker';
import { useDebouncedCallback } from 'use-debounce';

import { cn } from '../../lib/utils';

import { Button } from './button';
import { Calendar } from './calendar';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type CommonProps = Omit<PropsSingle, 'mode' | 'selected' | 'onSelect'> & {
  value: Date | undefined | null;
  setValue: (date: Date | undefined | null) => void;
  clearable?: boolean;
};

export type DatePickerProps =
  | (CommonProps & { children?: never; className?: string; placeholder?: string })
  | (CommonProps & { children: React.ReactNode; className?: never; placeholder?: string });

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  setValue,
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
          <DefaultButton
            value={value}
            placeholder={placeholder}
            className={className}
            data-testid="datepicker-button"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        className="backdrop-blur-4xl w-auto p-0 bg-transparent"
        align="start"
        data-testid="datepicker-calendar"
      >
        <DatePickerOnly
          value={value}
          setValue={v => setValue(v ? new Date(`${v}z`) : null)} // TODO: Leave in the Z to prevent casting via timezone
          clearable={props.clearable}
          setOpenPopover={setOpenPopover}
          {...props}
        />
      </PopoverContent>
    </Popover>
  );
};

export const DatePickerOnly = ({
  value,
  setValue,
  setOpenPopover,
  clearable,
  placeholder,
  className,
  ...props
}: CommonProps & {
  setOpenPopover?: (open: boolean) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [inputValue, setInputValue] = React.useState<string>(value ? format(value, 'PP') : '');
  const [selected, setSelected] = React.useState<Date | undefined>(value ? new Date(value) : undefined);

  const debouncedDateUpdate = useDebouncedCallback((date: Date) => {
    if (isValid(date)) {
      setSelected(date);
      setValue?.(date);
      setOpenPopover?.(false);
    }
  }, 2000);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    setInputValue(e.currentTarget.value);
    const date = new Date(e.target.value);
    debouncedDateUpdate(date);
  };

  const handleDaySelect = (date: Date | undefined) => {
    setSelected(date);
    setValue?.(date);
    setOpenPopover?.(false);
    if (date) {
      setInputValue(format(date, 'PP'));
    } else {
      setInputValue('');
    }
  };

  const handleMonthSelect = (date: Date | undefined) => {
    setSelected(date);
    if (date) {
      setInputValue(format(date, 'PP'));
    } else {
      setInputValue('');
    }
  };

  return (
    <div
      aria-label="Choose date"
      className="relative mt-2 flex flex-col gap-2"
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          setOpenPopover?.(false);
        }
      }}
    >
      <div className="w-full px-3">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
        />
      </div>
      <Calendar
        mode="single"
        month={selected}
        selected={selected}
        onMonthChange={handleMonthSelect}
        onSelect={handleDaySelect}
        {...props}
      />
      <div className="px-3 pb-2">
        {clearable && (
          <Button
            variant="outline"
            tabIndex={0}
            className="w-full !opacity-50 duration-200 hover:!opacity-100"
            onClick={() => {
              setValue(null);
              setSelected(undefined);
              setInputValue('');
              setOpenPopover?.(false);
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

interface DefaultButtonProps {
  className?: string;
  placeholder?: string;
  value: Date | undefined | null;
}

const DefaultButton = React.forwardRef<HTMLButtonElement, DefaultButtonProps>(
  ({ value, placeholder, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={'outline'}
        className={cn(
          'bg-neutral-825 border-neutral-775 w-full justify-start whitespace-nowrap rounded-md border px-2 py-0 text-left flex items-center gap-1',
          className,
        )}
        {...props}
      >
        <CalendarIcon className="h-4 w-4" />
        {value ? (
          <span className="text-white">{format(value, 'PPP')}</span>
        ) : (
          <span className="text-gray">{placeholder ?? 'Pick a date'}</span>
        )}
      </Button>
    );
  },
);

DefaultButton.displayName = 'DefaultButton';
