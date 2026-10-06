import type { AutoFormFieldProps } from '@autoform/react';
import React from 'react';
import { Textarea } from '@/ds/components/Textarea';
import { cn } from '@/utils/cn';

/**
 * Text fields are auto-growing textareas so long values wrap, but a textarea takes Enter as a new line,
 * which would stop Enter from submitting the form the way it does from any input. Enter submits;
 * Shift+Enter adds a line, and Enter that confirms an IME composition is left alone.
 */
function submitFormOnEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

export const StringField: React.FC<AutoFormFieldProps> = ({ inputProps, field }) => {
  const { key: _key, className, ...props } = inputProps;

  return (
    <Textarea
      {...props}
      rows={1}
      className={cn('field-sizing-content max-h-48 min-h-control-md resize-none overflow-y-auto', className)}
      defaultValue={field.default}
      onKeyDown={submitFormOnEnter}
    />
  );
};
