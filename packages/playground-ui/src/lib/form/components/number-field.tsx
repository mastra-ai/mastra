import type { AutoFormFieldProps } from '@autoform/react';
import React from 'react';
import { Input } from '@/ds/components/Input';

const INVALID = Symbol('invalid');

/** The form value for the input's text: a number, `undefined` when cleared, or INVALID to leave it as is. */
function toFieldValue(text: string): number | undefined | typeof INVALID {
  if (text === '') return undefined;
  const value = Number(text);
  return isNaN(value) ? INVALID : value;
}

export const NumberField: React.FC<AutoFormFieldProps> = ({ inputProps, field }) => {
  const { key, ...props } = inputProps;

  return (
    <Input
      type="number"
      step="any"
      {...props}
      defaultValue={field.default !== undefined ? Number(field.default) : undefined}
      onChange={e => {
        // Store the number as you type, not only on blur, so submitting with Enter sends a number.
        // A cleared input clears the value, so an emptied field never submits the previous number.
        const value = toFieldValue(e.target.value);
        if (value !== INVALID) props.onChange({ target: { value, name: inputProps.name } });
      }}
      onBlur={e => {
        const value = toFieldValue(e.target.value);
        if (value !== INVALID) props.onChange({ target: { value, name: inputProps.name } });
      }}
    />
  );
};
