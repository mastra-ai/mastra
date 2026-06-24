import { EyeIcon, EyeOffIcon, TrashIcon } from 'lucide-react';

import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorRowProps } from './environment-variables-editor.types';
import { Button } from '@/ds/components/Button';
import { FieldBlock } from '@/ds/components/FormFieldBlocks';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import { DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE } from '@/lib/env-file';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorRow({
  row,
  index,
  rowErrors,
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
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
  const keyFieldName = `env-key-${index}`;
  const valueFieldName = `env-value-${index}`;
  const keyInputId = `input-${keyFieldName}`;
  const valueInputId = `input-${valueFieldName}`;

  function handlePaste(text: string) {
    return editor.handlePaste(index, text);
  }

  return (
    <div className={cn('flex flex-col items-stretch gap-2 sm:flex-row sm:items-start', className)} {...props}>
      <div className="flex-1">
        <FieldBlock.Layout>
          <FieldBlock.Column>
            <FieldBlock.Label name={keyFieldName}>{keyLabel}</FieldBlock.Label>
            <InputGroup className="w-full">
              <InputGroupInput
                id={keyInputId}
                placeholder={keyPlaceholder}
                className="font-mono"
                value={row.key}
                disabled={isDisabled}
                error={Boolean(keyError)}
                onChange={event => editor.updateRow(index, { key: event.target.value })}
                onPaste={event => {
                  if (handlePaste(event.clipboardData.getData('text'))) {
                    event.preventDefault();
                  }
                }}
              />
            </InputGroup>
            {keyError && <FieldBlock.ErrorMsg>{keyError}</FieldBlock.ErrorMsg>}
          </FieldBlock.Column>
        </FieldBlock.Layout>
      </div>

      <div className="flex-1">
        <FieldBlock.Layout>
          <FieldBlock.Column>
            <FieldBlock.Label name={valueFieldName}>{valueLabel}</FieldBlock.Label>
            <InputGroup className="w-full">
              <InputGroupInput
                id={valueInputId}
                placeholder={valuePlaceholder}
                className="font-mono"
                type={editor.isValueRevealed(index) ? 'text' : 'password'}
                value={row.value}
                disabled={isDisabled}
                error={Boolean(valueError)}
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
                  aria-label={editor.isValueRevealed(index) ? 'Hide value' : 'Show value'}
                  onClick={() => editor.toggleValueVisibility(index)}
                >
                  {editor.isValueRevealed(index) ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {valueError && <FieldBlock.ErrorMsg>{valueError}</FieldBlock.ErrorMsg>}
          </FieldBlock.Column>
        </FieldBlock.Layout>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 self-end sm:self-auto sm:pt-7">
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            disabled={disabled}
            aria-label={`Remove environment variable ${row.key.trim() || index + 1}`}
            onClick={() => editor.removeRow(index)}
          >
            <TrashIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
