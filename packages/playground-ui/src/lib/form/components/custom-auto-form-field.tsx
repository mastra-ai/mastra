import React, { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { getLabel, ParsedField } from '@autoform/core';
import { CustomObjectField } from './custom-object-field';
import { CustomArrayField } from './custom-array-field';
import { getPathInObject, useAutoForm, AutoFormFieldProps } from '@autoform/react';

export const CustomAutoFormField: React.FC<{
  field: ParsedField;
  path: string[];
}> = ({ field, path }) => {
  const { formComponents, uiComponents } = useAutoForm();
  const {
    register,
    formState: { errors, defaultValues },
    getValues,
  } = useFormContext();

  const fullPath = path.join('.');
  const error = getPathInObject(errors, path)?.message as string | undefined;
  const value = getValues(fullPath);

  const fieldDefault = useMemo(() => {
    if (!defaultValues) return undefined;
    const firstPath = path[0];
    let current = defaultValues[firstPath];
    for (let i = 1; i < path.length; i++) {
      const key = path[i];
      if (current[key] !== undefined) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }, [defaultValues, path]);

  const FieldWrapper = field.fieldConfig?.fieldWrapper || uiComponents.FieldWrapper;

  let FieldComponent: React.ComponentType<AutoFormFieldProps> = () => (
    <uiComponents.ErrorMessage
      error={`[AutoForm Configuration Error] No component found for type "${field.type}" nor a fallback`}
    />
  );

  if (field.type === 'array') {
    FieldComponent = CustomArrayField;
  } else if (field.type === 'object') {
    FieldComponent = CustomObjectField;
  } else if (field.type in formComponents) {
    FieldComponent = formComponents[field.type as keyof typeof formComponents]!;
  } else if ('fallback' in formComponents) {
    FieldComponent = formComponents.fallback;
  }

  return (
    <FieldWrapper label={getLabel(field)} error={error} id={fullPath} field={field}>
      <FieldComponent
        label={getLabel(field)}
        field={{ ...field, default: fieldDefault }}
        value={value}
        error={error}
        id={fullPath}
        key={fullPath}
        path={path}
        inputProps={{
          required: field.required,
          error: error,
          key: `${fullPath}-input`,
          ...field.fieldConfig?.inputProps,
          ...register(fullPath),
        }}
      />
    </FieldWrapper>
  );
};
