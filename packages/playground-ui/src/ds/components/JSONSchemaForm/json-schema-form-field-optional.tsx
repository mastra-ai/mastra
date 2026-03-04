import * as React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/ds/components/Checkbox';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

type CheckboxProps = React.ComponentPropsWithoutRef<typeof Checkbox>;

export type JSONSchemaFormFieldOptionalProps = Omit<CheckboxProps, 'checked' | 'onCheckedChange'> & {
  label?: string;
  labelClassName?: string;
};

export function FieldOptional({
  label = 'Optional',
  labelClassName,
  className,
  ...props
}: JSONSchemaFormFieldOptionalProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleCheckedChange = React.useCallback(
    (checked: boolean | 'indeterminate') => {
      update({ optional: checked === true });
    },
    [update],
  );

  return (
    <label className={cn('flex items-center gap-2 text-ui-sm text-neutral3 cursor-pointer', labelClassName)}>
      <Checkbox {...props} className={className} checked={field.optional} onCheckedChange={handleCheckedChange} />
      {label}
    </label>
  );
}
