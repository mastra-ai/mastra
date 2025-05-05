import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { AutoFormFieldProps } from '@autoform/react';
import { Label } from '../../label';

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
    />
    <Label htmlFor={id}>
      {label}
      {field.required && <span className="text-destructive"> *</span>}
    </Label>
  </div>
);
