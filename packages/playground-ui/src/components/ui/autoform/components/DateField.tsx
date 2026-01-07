import { AutoFormFieldProps } from '@autoform/react';
import { format, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/ds/components/Button/Button';
import { DatePicker } from '../../elements/date-time-picker/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';

export const DateField: React.FC<AutoFormFieldProps> = ({ inputProps, field, error, id }) => {
  const { key, ...props } = inputProps;
  const [value, setValue] = useState<Date | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (field.default) {
      const date = new Date(field.default);
      if (isValid(date)) {
        setValue(date);
      }
    }
  }, [field]);

  const handleSelect = (date: Date | undefined) => {
    setValue(date);
    if (date) {
      props.onChange({
        target: { value: date.toISOString(), name: inputProps.name },
      });
    }
    setOpen(false);
  };

  const handleClear = () => {
    setValue(undefined);
    props.onChange({
      target: { value: '', name: inputProps.name },
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="light" size="lg" className={cn('w-full', error ? 'border-destructive' : '')}>
          <CalendarIcon className="h-4 w-4" />
          {value ? (
            <span className="text-white">{format(value, 'PPP')}</span>
          ) : (
            <span className="text-gray">Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-surface4" align="start">
        <DatePicker mode="single" selected={value} onSelect={handleSelect} month={value} onMonthChange={setValue} />
        {value && (
          <div className="p-3 pt-0">
            <Button variant="light" size="lg" className="w-full" onClick={handleClear}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
