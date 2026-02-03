import * as React from 'react';
import { cn } from '@/lib/utils';
import { SelectField, type SelectFieldProps } from '@/ds/components/FormFields/select-field';
import { useJSONSchemaFormField } from './json-schema-form-field-context';
import type { FieldType } from './types';

const TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'text', label: 'Text' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

export type JSONSchemaFormFieldTypeProps = Omit<SelectFieldProps, 'value' | 'onValueChange' | 'options' | 'name'>;

export function FieldType({ className, ...props }: JSONSchemaFormFieldTypeProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleValueChange = React.useCallback(
    (value: string) => {
      update({ type: value as FieldType });
    },
    [update],
  );

  return (
    <SelectField
      {...props}
      className={cn('text-neutral6', className)}
      name={`field-type-${field.id}`}
      value={field.type}
      onValueChange={handleValueChange}
      options={TYPE_OPTIONS}
    />
  );
}
