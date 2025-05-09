import { Input } from '@/components/ui/input';
import { AutoFormFieldProps } from '@autoform/react';
import React, { useEffect } from 'react';

export const NumberField: React.FC<AutoFormFieldProps> = ({ inputProps, error, field, id }) => {
  const { key, ...props } = inputProps;

  useEffect(() => {
    if (field.default !== undefined) {
      props.onChange({
        target: { value: Number(field.default), name: inputProps.name },
      });
    }
  }, [field.default]);

  return (
    <Input
      id={id}
      type="number"
      className={error ? 'border-destructive' : ''}
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
