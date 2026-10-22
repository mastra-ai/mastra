import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Field, FieldLabel } from '../Field';
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
    <Field orientation="horizontal">
      <Checkbox {...props} className={className} checked={field.nullable} onCheckedChange={handleCheckedChange} />
      {label ? (
        <FieldLabel size="smaller" className={labelClassName}>
          {label}
        </FieldLabel>
      ) : null}
    </Field>
  );
}
