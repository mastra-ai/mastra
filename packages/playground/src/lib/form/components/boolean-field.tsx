import type { AutoFormFieldProps } from '@autoform/react';
import { Checkbox, Txt } from '@mastra/playground-ui';
import React from 'react';

export const BooleanField: React.FC<AutoFormFieldProps> = ({ field, label, id, inputProps }) => (
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
    <Txt as="label" variant="ui-sm" className="text-neutral3" htmlFor={id}>
      {label}
      {field.required && <span className="text-accent2"> *</span>}
    </Txt>
  </div>
);
