import type { ParsedField } from '@autoform/core';
import { getLabel } from '@autoform/core';
import type { AutoFormFieldProps } from '@autoform/react';
import { getPathInObject, useAutoForm } from '@autoform/react';
import React, { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { CustomArrayField } from './custom-array-field';
import { CustomObjectField } from './custom-object-field';

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
    if (!defaultValues) return field.default;
    const resolved = getPathInObject(defaultValues, path);
    return resolved === undefined ? field.default : resolved;
  }, [defaultValues, path, field.default]);

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

  const fieldWithDefault = { ...field, default: fieldDefault };

  return (
    <FieldWrapper label={getLabel(field)} error={error} id={fullPath} field={fieldWithDefault}>
      <FieldComponent
        label={getLabel(field)}
        field={fieldWithDefault}
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
