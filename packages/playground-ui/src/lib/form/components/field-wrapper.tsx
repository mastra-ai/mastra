import type { FieldWrapperProps } from '@autoform/react';
import React from 'react';
import { FieldBlock } from '@/ds/components/FormFieldBlocks';
import { Txt } from '@/ds/components/Txt';

const DISABLED_LABELS = ['boolean', 'object', 'array'];

export const FieldWrapper: React.FC<FieldWrapperProps> = ({ label, children, id, field, error }) => {
  const isDisabled = DISABLED_LABELS.includes(field.type);

  return (
    // Stack the label over the control so inline controls (select, date) fill the row like inputs do.
    <div className="flex flex-col gap-1 pb-4 last:pb-0">
      {!isDisabled && (
        <FieldBlock.Label name={id} htmlFor={id} required={field.required} className="self-start">
          {label}
        </FieldBlock.Label>
      )}

      {children}

      {field.fieldConfig?.description && (
        <Txt as="p" variant="caption" tone="ink">
          {field.fieldConfig.description}
        </Txt>
      )}

      {error && <FieldBlock.ErrorMsg name={id}>{error}</FieldBlock.ErrorMsg>}
    </div>
  );
};
