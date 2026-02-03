import * as React from 'react';
import { Trash2Icon } from 'lucide-react';
import { IconButton, type IconButtonProps } from '@/ds/components/IconButton';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

export type JSONSchemaFormFieldRemoveProps = Omit<IconButtonProps, 'onClick' | 'tooltip' | 'children'> & {
  tooltip?: React.ReactNode;
  children?: React.ReactNode;
};

export function FieldRemove({
  children,
  tooltip = 'Remove field',
  ...props
}: JSONSchemaFormFieldRemoveProps) {
  const { remove } = useJSONSchemaFormField();

  return (
    <IconButton {...props} tooltip={tooltip} onClick={remove}>
      {children || <Trash2Icon />}
    </IconButton>
  );
}
