import React from 'react';

import { FieldWrapperProps } from '@autoform/react';
import { Txt } from '@/ds/components/Txt';

const DISABLED_LABELS = ['boolean', 'object', 'array'];

export const FieldWrapper: React.FC<FieldWrapperProps> = ({ label, children, id, field, error }) => {
  const isDisabled = DISABLED_LABELS.includes(field.type);

  return (
    <div className="pb-4 last:pb-0">
      {!isDisabled && (
        <Txt as="label" variant="ui-sm" className="text-icon3 pb-1 block" htmlFor={id}>
          {label}
          {field.required && <span className="text-accent2"> *</span>}
        </Txt>
      )}

      {children}

      {field.fieldConfig?.description && (
        <Txt as="p" variant="ui-sm" className="text-icon6">
          {field.fieldConfig.description}
        </Txt>
      )}

      {error && (
        <Txt as="p" variant="ui-sm" className="text-accent2">
          {error}
        </Txt>
      )}
    </div>
  );
};
