import { Type, Hash, ToggleLeft, AlignLeft, Braces, List } from 'lucide-react';
import * as React from 'react';
import { Field, FieldLabel } from '../Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import type { SelectTriggerProps } from '../Select/select';
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

export type JSONSchemaFormFieldTypeProps = {
  label?: React.ReactNode;
  labelIsHidden?: boolean;
  placeholder?: string;
  size?: SelectTriggerProps['size'];
  disabled?: boolean;
  className?: string;
};

export function FieldType({
  label = 'Select type',
  labelIsHidden = true,
  placeholder = 'Select an option',
  size = 'md',
  disabled,
  className,
}: JSONSchemaFormFieldTypeProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleValueChange = React.useCallback(
    (value: string) => {
      update({ type: value as FieldType });
    },
    [update],
  );

  return (
    <Field disabled={disabled} className={cn('w-28 shrink-0', className)}>
      <FieldLabel className={labelIsHidden ? 'sr-only' : undefined}>{label}</FieldLabel>
      <Select value={field.type} onValueChange={handleValueChange}>
        <SelectTrigger size={size}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
