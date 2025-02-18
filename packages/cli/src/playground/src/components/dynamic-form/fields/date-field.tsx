'use client';

import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { DatePicker } from '../../ui/date-picker';

interface DateFieldProps {
  name: string;
  control: Control<any>;
  handleFieldChange?: (props: { key: string; value: Date | null | undefined }) => void;
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
            field.onChange(date);
            handleFieldChange?.({ key: name, value: date });
          }}
        />
      )}
    />
  );
}
