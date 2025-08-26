'use client';

import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Switch } from '../../ui/switch';

interface BooleanFieldProps {
  name: string;
  control: Control<any>;
  handleFieldChange?: (props: { key: string; value: boolean }) => void;
}

export function BooleanField({ name, control, handleFieldChange }: BooleanFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Switch
          checked={field.value}
          onCheckedChange={checked => {
            field.onChange(checked);
            handleFieldChange?.({ key: name, value: checked });
          }}
        />
      )}
    />
  );
}
