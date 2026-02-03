import * as React from 'react';
import { InputField, type InputFieldProps } from '@/ds/components/FormFields/input-field';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

export type JSONSchemaFormFieldNameProps = Omit<InputFieldProps, 'value' | 'onChange' | 'name'>;

export function FieldName(props: JSONSchemaFormFieldNameProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      update({ name: e.target.value });
    },
    [update],
  );

  return (
    <InputField
      {...props}
      name={`field-name-${field.id}`}
      value={field.name}
      onChange={handleChange}
    />
  );
}
