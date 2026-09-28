import type { AutoFormFieldProps } from '@autoform/react';
import React from 'react';
import { Textarea } from '@/ds/components/Textarea';
import { cn } from '@/utils/cn';

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
