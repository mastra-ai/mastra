import { Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { Button } from '../Button';
import type { ButtonProps } from '../Button';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

export type JSONSchemaFormFieldRemoveProps = Omit<ButtonProps, 'onClick' | 'tooltip' | 'children' | 'size'> & {
  tooltip?: React.ReactNode;
  children?: React.ReactNode;
};

export function FieldRemove({ children, tooltip = 'Remove field', ...props }: JSONSchemaFormFieldRemoveProps) {
  const { remove } = useJSONSchemaFormField();

  return (
    <Button {...props} tooltip={tooltip} onClick={remove} size="icon-md">
      {children || <Trash2Icon />}
    </Button>
  );
}
