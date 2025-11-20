import React from 'react';
import { CustomAutoFormField } from './CustomAutoFormField';
import { useAutoForm } from '@autoform/react';
import { getLabel, ParsedField } from '@autoform/core';

export const CustomObjectField: React.FC<{
  field: ParsedField;
  path: string[];
}> = ({ field, path }) => {
  const { uiComponents } = useAutoForm();

  return (
    <uiComponents.ObjectWrapper label={getLabel(field)} field={field}>
      {Object.entries(field.schema!).map(([_key, subField]) => (
        <CustomAutoFormField
          key={`${path.join('.')}.${subField.key}`}
          field={subField}
          path={[...path, subField.key]}
        />
      ))}
    </uiComponents.ObjectWrapper>
  );
};
