import { Type, Hash, ToggleLeft, AlignLeft, Braces, List } from 'lucide-react';
import * as React from 'react';
import type { SelectFieldBlockProps } from '../FormFieldBlocks/fields/select-field-block';
import { SelectFieldBlock } from '../FormFieldBlocks/fields/select-field-block';
import { useJSONSchemaFormField } from './json-schema-form-field-context';
import type { FieldType } from './types';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS = [
  {
    value: 'string',
    label: 'String',
    icon: (
      <Icon size="xs">
        <Type />
      </Icon>
    ),
  },
  {
    value: 'number',
    label: 'Number',
    icon: (
      <Icon size="xs">
        <Hash />
      </Icon>
    ),
  },
  {
    value: 'boolean',
    label: 'Boolean',
    icon: (
      <Icon size="xs">
        <ToggleLeft />
      </Icon>
    ),
  },
  {
    value: 'text',
    label: 'Text',
    icon: (
      <Icon size="xs">
        <AlignLeft />
      </Icon>
    ),
  },
  {
    value: 'object',
    label: 'Object',
    icon: (
      <Icon size="xs">
        <Braces />
      </Icon>
    ),
  },
  {
    value: 'array',
    label: 'Array',
    icon: (
      <Icon size="xs">
        <List />
      </Icon>
    ),
  },
];

export type JSONSchemaFormFieldTypeProps = Omit<SelectFieldBlockProps, 'value' | 'onValueChange' | 'options' | 'name'>;

export function FieldType({ className, ...props }: JSONSchemaFormFieldTypeProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleValueChange = React.useCallback(
    (value: string) => {
      update({ type: value as FieldType });
    },
    [update],
  );

  return (
    <SelectFieldBlock
      className={cn('w-28 shrink-0', className)}
      name={`field-type-${field.id}`}
      label="Select type"
      labelIsHidden
      value={field.type}
      onValueChange={handleValueChange}
      options={TYPE_OPTIONS}
      size="md"
      {...props}
    />
  );
}
