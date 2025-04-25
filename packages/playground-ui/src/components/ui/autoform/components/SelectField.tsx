import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutoFormFieldProps } from '@autoform/react';
import React from 'react';

export const SelectField: React.FC<AutoFormFieldProps> = ({ field, inputProps, error, id }) => {
  const { key, ...props } = inputProps;

  return (
    <Select
      {...props}
      onValueChange={value => {
        const syntheticEvent = {
          target: {
            value,
            name: inputProps.name,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        props.onChange(syntheticEvent);
      }}
      defaultValue={field.default}
    >
      <SelectTrigger id={id} className={error ? 'border-destructive' : ''}>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {(field.options || []).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
