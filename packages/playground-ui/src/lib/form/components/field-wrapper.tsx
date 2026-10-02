import type { FieldWrapperProps } from '@autoform/react';
import React from 'react';
import { Field, FieldDescription, FieldError, FieldLabel, Fieldset, FieldsetLegend } from '@/ds/components/Field';

const GROUP_TYPES = ['object', 'array'];

function GroupFooter({ description, error }: { description?: React.ReactNode; error?: string }) {
  if (!description && !error) return null;
  return (
    <Field invalid={Boolean(error)}>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export const FieldWrapper: React.FC<FieldWrapperProps> = ({ label, children, field, error }) => {
  const description = field.fieldConfig?.description;

  if (field.type === 'record') {
    return (
      <Fieldset className="gap-2 pb-4 last:pb-0">
        <FieldsetLegend required={field.required}>{label}</FieldsetLegend>
        {children}
        <GroupFooter description={description} error={error} />
      </Fieldset>
    );
  }

  if (GROUP_TYPES.includes(field.type)) {
    return (
      <div className="pb-4 last:pb-0">
        {children}
        <GroupFooter description={description} error={error} />
      </div>
    );
  }

  const rendersOwnLabel = field.type === 'boolean';

  return (
    <Field invalid={Boolean(error)} className="pb-4 last:pb-0">
      {!rendersOwnLabel && <FieldLabel required={field.required}>{label}</FieldLabel>}

      {children}

      {description && <FieldDescription>{description}</FieldDescription>}

      <FieldError>{error}</FieldError>
    </Field>
  );
};
