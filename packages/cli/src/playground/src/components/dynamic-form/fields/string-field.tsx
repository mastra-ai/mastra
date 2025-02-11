'use client';

import { Control, Controller } from 'react-hook-form';

import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';

interface StringFieldProps {
  name: string;
  control: Control<any>;
  handleFieldChange?: (props: { key: string; value: any }) => void;
  isMultiline?: boolean;
  placeholder?: string;
}

export function StringField({ name, control, handleFieldChange, isMultiline, placeholder }: StringFieldProps) {
  const Component = isMultiline ? Textarea : Input;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Component
          {...field}
          className="w-full"
          placeholder={placeholder}
          onChange={e => {
            field.onChange(e);
            handleFieldChange?.({ key: name, value: e.target.value });
          }}
        />
      )}
    />
  );
}
