import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { AutoFormFieldProps } from '@autoform/react';
import { Txt } from '@/ds/components/Txt';

export const BooleanField: React.FC<AutoFormFieldProps> = ({ field, label, id, inputProps, value }) => (
  <div className="flex items-center space-x-2">
    <Checkbox
      id={id}
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
    <Txt as="label" variant="ui-sm" className="text-icon3" htmlFor={id}>
      {label}
      {field.required && <span className="text-accent2"> *</span>}
    </Txt>
  </div>
);
