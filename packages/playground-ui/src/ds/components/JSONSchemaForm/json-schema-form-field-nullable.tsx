import * as React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/ds/components/Checkbox';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

type CheckboxProps = React.ComponentPropsWithoutRef<typeof Checkbox>;

export type JSONSchemaFormFieldNullableProps = Omit<CheckboxProps, 'checked' | 'onCheckedChange'> & {
  label?: string;
  labelClassName?: string;
};

export function FieldNullable({
  label = 'Nullable',
  labelClassName,
  className,
  ...props
}: JSONSchemaFormFieldNullableProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleCheckedChange = React.useCallback(
    (checked: boolean | 'indeterminate') => {
      update({ nullable: checked === true });
    },
    [update],
  );

  return (
    <label className={cn('flex items-center gap-2 text-ui-sm text-neutral3 cursor-pointer', labelClassName)}>
      <Checkbox {...props} className={className} checked={field.nullable} onCheckedChange={handleCheckedChange} />
      {label}
    </label>
  );
}
