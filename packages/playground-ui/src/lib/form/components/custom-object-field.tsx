import type { ParsedField } from '@autoform/core';
import { getLabel } from '@autoform/core';
import { useAutoForm } from '@autoform/react';
import React from 'react';
import { FieldPathContext } from '../field-context';
import { CustomAutoFormField } from './custom-auto-form-field';

export const CustomObjectField: React.FC<{
  field: ParsedField;
  path: string[];
}> = ({ field, path }) => {
  const { uiComponents } = useAutoForm();

  return (
    <FieldPathContext value={path.join('.')}>
      <uiComponents.ObjectWrapper label={getLabel(field)} field={field}>
        {Object.entries(field.schema ?? []).map(([_key, subField]) => (
          <CustomAutoFormField
            key={`${path.join('.')}.${subField.key}`}
            field={subField}
            path={[...path, subField.key]}
          />
        ))}
      </uiComponents.ObjectWrapper>
    </FieldPathContext>
  );
};
