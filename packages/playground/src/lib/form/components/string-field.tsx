import type { AutoFormFieldProps } from '@autoform/react';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import React from 'react';

export const StringField: React.FC<AutoFormFieldProps> = ({ inputProps, error, field, id }) => {
  const { key, className, ...props } = inputProps;

  return (
    <Textarea
      id={id}
      {...props}
      rows={1}
      className={cn('field-sizing-content min-h-form-default max-h-48 resize-none overflow-y-auto', className)}
      error={Boolean(error)}
      defaultValue={field.default}
    />
  );
};
