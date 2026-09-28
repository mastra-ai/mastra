import type { AutoFormFieldProps } from '@autoform/react';
import { format, isValid } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Button } from '@/ds/components/Button';
import { DatePicker } from '@/ds/components/DateTimePicker';
import { useFieldControlAria } from '@/ds/components/Field';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';

export const DateField: React.FC<AutoFormFieldProps> = ({ inputProps, field }) => {
  const { key, ...props } = inputProps;
  const [value, setValue] = useState<Date | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const fieldAria = useFieldControlAria();

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
        <Button
          {...fieldAria}
          variant="default"
          size="lg"
          className="w-full aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive"
          icon={<CalendarIcon />}
        >
          {value ? (
            <span className="text-white">{format(value, 'PPP')}</span>
          ) : (
            <span className="text-gray">Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto bg-muted p-0" align="start">
        <DatePicker mode="single" selected={value} onSelect={handleSelect} month={value} onMonthChange={setValue} />
        {value && (
          <div className="p-3 pt-0">
            <Button icon={<X />} variant="default" size="lg" className="w-full" onClick={handleClear}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
