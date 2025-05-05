import { AutoFormFieldProps } from '@autoform/react';
import React, { useState, useEffect } from 'react';
import { DatePicker } from '../../date-picker';
import { isValid } from 'date-fns';

export const DateField: React.FC<AutoFormFieldProps> = ({ inputProps, field, error, id }) => {
  const { key, ...props } = inputProps;
  const [value, setValue] = useState<Date | null>(null);

  useEffect(() => {
    if (field.default) {
      const date = new Date(field.default);
      if (isValid(date)) {
        setValue(date);
      }
    }
  }, [field]);

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
