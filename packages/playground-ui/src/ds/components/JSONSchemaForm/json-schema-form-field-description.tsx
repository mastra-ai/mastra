import * as React from 'react';
import { TextFieldBlock } from '../FormFieldBlocks/fields/text-field-block';
import type { TextFieldBlockProps } from '../FormFieldBlocks/fields/text-field-block';
import { useJSONSchemaFormField } from './json-schema-form-field-context';

export type JSONSchemaFormFieldDescriptionProps = Omit<TextFieldBlockProps, 'value' | 'onChange' | 'name'>;

export function FieldDescription(props: JSONSchemaFormFieldDescriptionProps) {
  const { field, update } = useJSONSchemaFormField();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      update({ description: e.target.value });
    },
    [update],
  );

  return (
    <TextFieldBlock
      {...props}
      name={`field-description-${field.id}`}
      value={field.description || ''}
      onChange={handleChange}
      size="md"
    />
  );
}
