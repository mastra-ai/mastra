import * as React from 'react';
import { Field, FieldLabel } from '../Field';
import { Input } from '../Input';
import type { InputProps } from '../Input';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

export type JSONSchemaFormFieldNameProps = Omit<InputProps, 'value' | 'onChange' | 'name'> & {
  label?: React.ReactNode;
  labelIsHidden?: boolean;
};

export function FieldName({ label, labelIsHidden = true, className, ...props }: JSONSchemaFormFieldNameProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      update({ name: e.target.value });
    },
    [update],
  );

  return (
    <Field className={className}>
      {label ? <FieldLabel className={labelIsHidden ? 'sr-only' : undefined}>{label}</FieldLabel> : null}
      <Input {...props} size="md" value={field.name} onChange={handleChange} />
    </Field>
  );
}
