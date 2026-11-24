import type { AutoFormFieldProps } from '@autoform/react';
import React from 'react';
import { Checkbox } from '@/ds/components/Checkbox';
import { FieldLabel } from '@/ds/components/Field';

export const BooleanField: React.FC<AutoFormFieldProps> = ({ field, label, inputProps }) => (
  <div className="flex items-center space-x-2">
    <Checkbox
      onCheckedChange={checked => {
        // react-hook-form expects an event object
        const event = {
          target: {
            name: inputProps.name,
            value: checked,
          },
        };
        inputProps.onChange(event);
      }}
      defaultChecked={field.default}
      disabled={inputProps.disabled || inputProps.readOnly}
    />
    <FieldLabel required={field.required}>{label}</FieldLabel>
  </div>
);
