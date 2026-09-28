import { EyeIcon, EyeOffIcon, TrashIcon } from 'lucide-react';

import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorRowProps } from './environment-variables-editor.types';
import { Button } from '@/ds/components/Button';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import { DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE } from '@/lib/env-file';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorRow({
  row,
  index,
  rowErrors,
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder = 'e.g: OPEN_AI_KEY',
  valuePlaceholder = 'e.g: sk-xxxxxxxx',
  duplicateKeyMessage = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  className,
  ...props
}: EnvironmentVariablesEditorRowProps) {
  const {
    editor,
    disabled,
    readOnly,
    rowErrors: contextRowErrors,
  } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.Row');
  const isDisabled = disabled || readOnly;
  const resolvedRowErrors = rowErrors ?? contextRowErrors;
  const keyError = resolvedRowErrors?.[index]?.key ?? (editor.rowHasDuplicateKey(index) ? duplicateKeyMessage : null);
  const valueError = resolvedRowErrors?.[index]?.value;
  const revealValueLabel = editor.isValueRevealed(index) ? 'Hide value' : 'Show value';
  const removeRowLabel = `Remove environment variable ${row.key.trim() || index + 1}`;

  function handlePaste(text: string) {
    return editor.handlePaste(index, text);
  }

  return (
    <div className={cn('flex flex-col items-stretch gap-2 sm:flex-row sm:items-start', className)} {...props}>
      <Field invalid={Boolean(keyError)} className="flex-1">
        <FieldLabel>{keyLabel}</FieldLabel>
        <InputGroup className="w-full">
          <InputGroupInput
            placeholder={keyPlaceholder}
            className="font-mono"
            value={row.key}
            disabled={isDisabled}
            onChange={event => editor.updateRow(index, { key: event.target.value })}
            onPaste={event => {
              if (handlePaste(event.clipboardData.getData('text'))) {
                event.preventDefault();
              }
            }}
          />
        </InputGroup>
        <FieldError>{keyError}</FieldError>
      </Field>

      <Field invalid={Boolean(valueError)} className="flex-1">
        <FieldLabel>{valueLabel}</FieldLabel>
        <InputGroup className="w-full">
          <InputGroupInput
            placeholder={valuePlaceholder}
            className="font-mono"
            type={editor.isValueRevealed(index) ? 'text' : 'password'}
            value={row.value}
            disabled={isDisabled}
            onChange={event => editor.updateRow(index, { value: event.target.value })}
            onPaste={event => {
              if (handlePaste(event.clipboardData.getData('text'))) {
                event.preventDefault();
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isDisabled}
              aria-label={revealValueLabel}
              tooltip={revealValueLabel}
              onClick={() => editor.toggleValueVisibility(index)}
            >
              {editor.isValueRevealed(index) ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldError>{valueError}</FieldError>
      </Field>

      {!readOnly && (
        <div className="flex items-center gap-2 self-end sm:self-auto sm:pt-7">
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            disabled={disabled}
            aria-label={removeRowLabel}
            tooltip="Remove variable"
            onClick={() => editor.removeRow(index)}
          >
            <TrashIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
