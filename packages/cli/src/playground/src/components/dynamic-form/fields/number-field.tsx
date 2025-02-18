'use client';

import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Input } from '../../ui/input';

interface NumberFieldProps {
  name: string;
  control: Control<any>;
  handleFieldChange?: (props: { key: string; value: number }) => void;
}

export function NumberField({ name, control, handleFieldChange }: NumberFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Input
          {...field}
          type="number"
          onChange={e => {
            const value = e.target.value === '' ? undefined : Number(e.target.value);
            field.onChange(value);
            handleFieldChange?.({ key: name, value: value as number });
          }}
        />
      )}
    />
  );
}
