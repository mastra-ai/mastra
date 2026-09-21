import type { FieldWrapperProps } from '@autoform/react';
import { FieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Txt } from '@mastra/playground-ui/components/Txt';
import React from 'react';

const DISABLED_LABELS = ['boolean', 'object', 'array'];

export const FieldWrapper: React.FC<FieldWrapperProps> = ({ label, children, id, field, error }) => {
  const isDisabled = DISABLED_LABELS.includes(field.type);

  return (
    <div className="pb-4 last:pb-0">
      {!isDisabled && (
        <FieldBlock.Label name={id} htmlFor={id} required={field.required} className="pb-1">
          {label}
        </FieldBlock.Label>
      )}

      {children}

      {field.fieldConfig?.description && (
        <Txt as="p" variant="caption" className="text-foreground">
          {field.fieldConfig.description}
        </Txt>
      )}

      {error && <FieldBlock.ErrorMsg name={id}>{error}</FieldBlock.ErrorMsg>}
    </div>
  );
};
