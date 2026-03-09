import * as React from 'react';
import { InputField, type InputFieldProps } from '@/ds/components/FormFields/input-field';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

export type JSONSchemaFormFieldDescriptionProps = Omit<InputFieldProps, 'value' | 'onChange' | 'name'>;

export function FieldDescription(props: JSONSchemaFormFieldDescriptionProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      update({ description: e.target.value });
    },
    [update],
  );

  return (
    <InputField
      {...props}
      name={`field-description-${field.id}`}
      value={field.description || ''}
      onChange={handleChange}
    />
  );
}
