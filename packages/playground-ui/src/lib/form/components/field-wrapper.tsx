import type { FieldWrapperProps } from '@autoform/react';
import React from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ds/components/Field';

const DISABLED_LABELS = ['boolean', 'object', 'array'];

export const FieldWrapper: React.FC<FieldWrapperProps> = ({ label, children, field, error }) => {
  const isDisabled = DISABLED_LABELS.includes(field.type);

  return (
    <Field invalid={Boolean(error)} className="pb-4 last:pb-0">
      {!isDisabled && <FieldLabel required={field.required}>{label}</FieldLabel>}

      {children}

      {field.fieldConfig?.description && <FieldDescription>{field.fieldConfig.description}</FieldDescription>}

      <FieldError>{error}</FieldError>
    </Field>
  );
};
