import type { AutoFormFieldProps } from '@autoform/react';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { FieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
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
    <FieldBlock.Label name={id} htmlFor={id} required={field.required}>
      {label}
    </FieldBlock.Label>
  </div>
);
