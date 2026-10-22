import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Field, FieldLabel } from '../Field';
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
    <Field orientation="horizontal">
      <Checkbox {...props} className={className} checked={field.optional} onCheckedChange={handleCheckedChange} />
      {label ? (
        <FieldLabel size="smaller" className={labelClassName}>
          {label}
        </FieldLabel>
      ) : null}
    </Field>
  );
}
