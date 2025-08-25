'use client';

import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { DatePicker } from '../../ui/date-picker';

interface DateFieldProps {
  name: string;
  control: Control<any>;
  handleFieldChange?: (props: { key: string; value: string | Date | null | undefined }) => void;
}

export function DateField({ name, control, handleFieldChange }: DateFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <DatePicker
          value={field.value}
          setValue={date => {
            const newDate = date ? new Date(date).toISOString() : date;
            field.onChange(newDate);
            handleFieldChange?.({ key: name, value: newDate });
          }}
        />
      )}
    />
  );
}
