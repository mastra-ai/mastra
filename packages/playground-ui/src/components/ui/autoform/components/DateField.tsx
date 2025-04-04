import { AutoFormFieldProps } from '@autoform/react';
import React, { useState } from 'react';
import { DatePicker } from '../../date-picker';

export const DateField: React.FC<AutoFormFieldProps> = ({ inputProps, error, id }) => {
  const { key, ...props } = inputProps;
  const [value, setValue] = useState<Date | null>(null);

  return (
    <DatePicker
      id={id}
      className={error ? 'border-destructive' : ''}
      value={value}
      setValue={date => {
        const newDate = date ? new Date(date).toISOString() : date;
        if (newDate) {
          props.onChange({
            target: { value: newDate?.toString(), name: inputProps.name },
          });
          setValue(new Date(newDate));
        }
      }}
      clearable={true}
    />
  );
};
