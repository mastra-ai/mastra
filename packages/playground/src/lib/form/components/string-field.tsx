import type { AutoFormFieldProps } from '@autoform/react';
import { Input } from '@mastra/playground-ui';
import React from 'react';

export const StringField: React.FC<AutoFormFieldProps> = ({ inputProps, error, field, id }) => {
  const { key, ...props } = inputProps;

  return <Input id={id} className={error ? 'border-accent2' : ''} {...props} defaultValue={field.default} />;
};
