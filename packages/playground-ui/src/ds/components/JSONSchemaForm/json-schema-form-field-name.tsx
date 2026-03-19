import * as React from 'react';
import { useJSONSchemaFormField } from './json-schema-form-field-context';
import { TextFieldBlock, type TextFieldBlockProps } from '../FormFieldBlocks/fields/text-field-block';

export type JSONSchemaFormFieldNameProps = Omit<TextFieldBlockProps, 'value' | 'onChange' | 'name'>;

export function FieldName(props: JSONSchemaFormFieldNameProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      update({ name: e.target.value });
    },
    [update],
  );

  return (
    <TextFieldBlock
      {...props}
      size="md"
      labelIsHidden
      name={`field-name-${field.id}`}
      value={field.name}
      onChange={handleChange}
    />
  );
}
