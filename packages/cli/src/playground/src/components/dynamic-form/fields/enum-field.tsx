'use client';

import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

interface EnumFieldProps {
  name: string;
  control: Control<any>;
  options: { label: string; value: string }[];
  handleFieldChange?: (props: { key: string; value: string }) => void;
}

export function EnumField({ name, control, options, handleFieldChange }: EnumFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={field.value}
          onValueChange={value => {
            field.onChange(value);
            handleFieldChange?.({ key: name, value });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value} className="text-white">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
