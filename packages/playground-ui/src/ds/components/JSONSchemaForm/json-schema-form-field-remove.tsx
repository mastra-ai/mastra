import { Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { ButtonWithTooltip } from '../Button';
import { useJSONSchemaFormField } from './json-schema-form-field-context';
import type { IconButtonProps } from '@/ds/components/IconButton';

export type JSONSchemaFormFieldRemoveProps = Omit<IconButtonProps, 'onClick' | 'tooltip' | 'children'> & {
  tooltip?: React.ReactNode;
  children?: React.ReactNode;
};

export function FieldRemove({ children, tooltip = 'Remove field', ...props }: JSONSchemaFormFieldRemoveProps) {
  const { remove } = useJSONSchemaFormField();

  return (
    <ButtonWithTooltip tooltipContent={tooltip} onClick={remove} size="md" {...props}>
      {children || <Trash2Icon />}
    </ButtonWithTooltip>
  );
}
