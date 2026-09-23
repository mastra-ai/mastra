import type { AutoFormFieldProps } from '@autoform/react';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import React from 'react';

export const StringField: React.FC<AutoFormFieldProps> = ({ inputProps, error, field, id }) => {
  const { key: _key, className, ...props } = inputProps;

  return (
    <Textarea
      id={id}
      {...props}
      rows={1}
      className={cn('field-sizing-content max-h-48 min-h-control-md resize-none overflow-y-auto', className)}
      error={Boolean(error)}
      defaultValue={field.default}
    />
  );
};
