import * as React from 'react';
import { useJSONSchemaFormField } from './json-schema-form-field-context';
import { Checkbox } from '@/ds/components/Checkbox';
import { Field, FieldLabel } from '@/ds/components/Field';
import { cn } from '@/lib/utils';

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
    <Field orientation="horizontal" className="gap-2">
      <Checkbox {...props} className={className} checked={field.optional} onCheckedChange={handleCheckedChange} />
      {label ? (
        <FieldLabel className={cn('cursor-pointer text-caption text-muted-foreground', labelClassName)}>
          {label}
        </FieldLabel>
      ) : null}
    </Field>
  );
}
