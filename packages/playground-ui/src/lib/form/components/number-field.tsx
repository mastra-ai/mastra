import { Input } from '@/ds/components/Input';
import { AutoFormFieldProps } from '@autoform/react';
import React from 'react';

export const NumberField: React.FC<AutoFormFieldProps> = ({ inputProps, error, field, id }) => {
  const { key, ...props } = inputProps;

  return (
    <Input
      id={id}
      type="number"
      className={error ? 'border-accent2' : ''}
      {...props}
      defaultValue={field.default !== undefined ? Number(field.default) : undefined}
      onChange={e => {
        const value = e.target.value;
        if (value !== '' && !isNaN(Number(value))) {
          props.onChange({
            target: { value: value, name: inputProps.name },
          });
        }
      }}
      onBlur={e => {
        const value = e.target.value;
        if (value !== '' && !isNaN(Number(value))) {
          props.onChange({
            target: { value: Number(value), name: inputProps.name },
          });
        }
      }}
    />
  );
};
