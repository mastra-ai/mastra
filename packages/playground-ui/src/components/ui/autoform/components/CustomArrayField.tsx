import React from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { CustomAutoFormField } from './CustomAutoFormField';
import { useAutoForm } from '@autoform/react';
import { getLabel, ParsedField } from '@autoform/core';

export const CustomArrayField: React.FC<{
  field: ParsedField;
  path: string[];
}> = ({ field, path }) => {
  const { uiComponents } = useAutoForm();
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: path.join('.'),
  });

  const subFieldType = field.schema?.[0]?.type;
  let defaultValue: any;
  if (subFieldType === 'object') {
    defaultValue = {};
  } else if (subFieldType === 'array') {
    defaultValue = [];
  } else {
    defaultValue = null;
  }

  return (
    <uiComponents.ArrayWrapper label={getLabel(field)} field={field} onAddItem={() => append(defaultValue)}>
      {fields.map((item, index) => (
        <uiComponents.ArrayElementWrapper key={item.id} onRemove={() => remove(index)} index={index}>
          <CustomAutoFormField field={field.schema![0]!} path={[...path, index.toString()]} />
        </uiComponents.ArrayElementWrapper>
      ))}
    </uiComponents.ArrayWrapper>
  );
};
