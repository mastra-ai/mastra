import { CheckIcon, Code2Icon, CopyIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon, UploadIcon } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList';
import type { DataListRootProps, DataListVariant } from '@/ds/components/DataList/data-list-root';
import { FieldBlock } from '@/ds/components/FormFieldBlocks';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import { Notice } from '@/ds/components/Notice';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type { EnvironmentVariablesEditorController } from '@/hooks/use-environment-variables-editor';
import { DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE } from '@/lib/env-file';
import type { EnvironmentVariableEntry } from '@/lib/env-file';
import { cn } from '@/lib/utils';

export type EnvironmentVariablesEditorRowErrors = Record<number, { key?: ReactNode; value?: ReactNode }>;

export interface EnvironmentVariablesEditorProps<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry> {
  editor: EnvironmentVariablesEditorController<TRow>;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  showUpload?: boolean;
  uploadLabel?: ReactNode;
  uploadInputLabel?: string;
  addLabel?: ReactNode;
  keyLabel?: ReactNode;
  valueLabel?: ReactNode;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  duplicateKeyMessage?: ReactNode;
  rowErrors?: EnvironmentVariablesEditorRowErrors;
  error?: ReactNode;
  actions?: ReactNode;
}

export interface EnvironmentVariablesEditorUploadProps<
  TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry,
> {
  editor: EnvironmentVariablesEditorController<TRow>;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  showUpload?: boolean;
  uploadLabel?: ReactNode;
  uploadInputLabel?: string;
}

export interface EnvironmentVariablesEditorRowsProps<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry> {
  editor: EnvironmentVariablesEditorController<TRow>;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  keyLabel?: ReactNode;
  valueLabel?: ReactNode;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  duplicateKeyMessage?: ReactNode;
  rowErrors?: EnvironmentVariablesEditorRowErrors;
}

export interface EnvironmentVariablesEditorRowProps<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry> {
  editor: EnvironmentVariablesEditorController<TRow>;
  row: TRow;
  index: number;
  disabled?: boolean;
  readOnly?: boolean;
  keyLabel?: ReactNode;
  valueLabel?: ReactNode;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  duplicateKeyMessage?: ReactNode;
  rowErrors?: EnvironmentVariablesEditorRowErrors;
}

export interface EnvironmentVariablesEditorAddButtonProps<
  TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry,
> {
  editor: EnvironmentVariablesEditorController<TRow>;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  addLabel?: ReactNode;
}

export interface EnvironmentVariablesEditorMessagesProps<
  TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry,
> {
  editor: EnvironmentVariablesEditorController<TRow>;
  duplicateKeyMessage?: ReactNode;
  error?: ReactNode;
  showDuplicateKeys?: boolean;
}

export type EnvironmentVariablesEditorActionsProps = ComponentPropsWithoutRef<'div'>;

const READ_ONLY_COLUMNS = 'minmax(12rem,1.4fr) minmax(8rem,0.9fr) minmax(8rem,auto)';
const READ_ONLY_COLUMNS_WITH_ICON = `auto ${READ_ONLY_COLUMNS}`;

const EnvironmentVariablesEditorReadOnlyListContext = createContext({
  showIcon: false,
});

export interface EnvironmentVariablesEditorReadOnlyListProps {
  children: ReactNode;
  className?: string;
  columns?: string;
  header?: ReactNode;
  showHeader?: boolean;
  showIcon?: boolean;
  nameLabel?: ReactNode;
  valueLabel?: ReactNode;
  updatedAtLabel?: ReactNode;
  variant?: DataListVariant;
  scrollRef?: DataListRootProps['scrollRef'];
}

export interface EnvironmentVariablesEditorReadOnlyHeaderProps {
  className?: string;
  nameLabel?: ReactNode;
  valueLabel?: ReactNode;
  updatedAtLabel?: ReactNode;
}

export interface EnvironmentVariablesEditorReadOnlyEmptyProps {
  className?: string;
  message?: string;
}

export interface EnvironmentVariablesEditorReadOnlyItemProps extends ComponentPropsWithoutRef<'div'> {
  name: ReactNode;
  value?: ReactNode;
  copyValue?: string;
  copyLabel?: string;
  updatedAt?: ReactNode;
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  actor?: ReactNode;
  icon?: ReactNode;
}

function EnvironmentVariablesEditorRoot<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  className,
  disabled,
  readOnly,
  showUpload = true,
  uploadLabel = 'Upload .env',
  uploadInputLabel = 'Upload .env file',
  addLabel = 'Add Variable',
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  duplicateKeyMessage = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  rowErrors,
  error,
  actions,
}: EnvironmentVariablesEditorProps<TRow>) {
  return (
    <div className={cn('space-y-3', className)}>
      <EnvironmentVariablesEditorUpload
        editor={editor}
        disabled={disabled}
        readOnly={readOnly}
        showUpload={showUpload}
        uploadLabel={uploadLabel}
        uploadInputLabel={uploadInputLabel}
      />

      <EnvironmentVariablesEditorMessages
        editor={editor}
        duplicateKeyMessage={duplicateKeyMessage}
        error={editor.uploadError}
        showDuplicateKeys={false}
      />

      <EnvironmentVariablesEditorRows
        editor={editor}
        disabled={disabled}
        readOnly={readOnly}
        keyLabel={keyLabel}
        valueLabel={valueLabel}
        keyPlaceholder={keyPlaceholder}
        valuePlaceholder={valuePlaceholder}
        duplicateKeyMessage={duplicateKeyMessage}
        rowErrors={rowErrors}
      />

      <EnvironmentVariablesEditorAddButton
        editor={editor}
        disabled={disabled}
        readOnly={readOnly}
        addLabel={addLabel}
      />

      <EnvironmentVariablesEditorMessages editor={editor} duplicateKeyMessage={duplicateKeyMessage} error={error} />

      {actions && <EnvironmentVariablesEditorActions>{actions}</EnvironmentVariablesEditorActions>}
    </div>
  );
}

function EnvironmentVariablesEditorUpload<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  className,
  disabled,
  readOnly,
  showUpload = true,
  uploadLabel = 'Upload .env',
  uploadInputLabel = 'Upload .env file',
}: EnvironmentVariablesEditorUploadProps<TRow>) {
  if (!showUpload || readOnly) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      <input
        ref={editor.fileInputRef}
        type="file"
        accept=".env,text/plain"
        aria-label={uploadInputLabel}
        className="hidden"
        disabled={disabled}
        onChange={editor.handleFileUpload}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => editor.fileInputRef.current?.click()}
      >
        <UploadIcon />
        {uploadLabel}
      </Button>
    </div>
  );
}

function EnvironmentVariablesEditorRows<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  className,
  disabled,
  readOnly,
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  duplicateKeyMessage = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  rowErrors,
}: EnvironmentVariablesEditorRowsProps<TRow>) {
  return (
    <div className={cn('space-y-2', className)}>
      {editor.rows.map((row, index) => (
        <EnvironmentVariablesEditorRow
          key={editor.getRowId(index)}
          editor={editor}
          row={row}
          index={index}
          disabled={disabled}
          readOnly={readOnly}
          keyLabel={keyLabel}
          valueLabel={valueLabel}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          duplicateKeyMessage={duplicateKeyMessage}
          rowErrors={rowErrors}
        />
      ))}
    </div>
  );
}

function EnvironmentVariablesEditorRow<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  row,
  index,
  disabled,
  readOnly,
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  duplicateKeyMessage = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  rowErrors,
}: EnvironmentVariablesEditorRowProps<TRow>) {
  const isDisabled = disabled || readOnly;
  const keyError = rowErrors?.[index]?.key ?? (editor.rowHasDuplicateKey(index) ? duplicateKeyMessage : null);
  const valueError = rowErrors?.[index]?.value;

  function handlePaste(text: string) {
    return editor.handlePaste(index, text);
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <FieldBlock.Layout>
          <FieldBlock.Column>
            <FieldBlock.Label name={`env-key-${index}`}>{keyLabel}</FieldBlock.Label>
            <InputGroup className="w-full">
              <InputGroupInput
                id={`input-env-key-${index}`}
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
            <FieldBlock.Label name={`env-value-${index}`}>{valueLabel}</FieldBlock.Label>
            <InputGroup className="w-full">
              <InputGroupInput
                id={`input-env-value-${index}`}
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

function EnvironmentVariablesEditorAddButton<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  className,
  disabled,
  readOnly,
  addLabel = 'Add Variable',
}: EnvironmentVariablesEditorAddButtonProps<TRow>) {
  if (readOnly) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span aria-hidden="true" className="h-px flex-1 bg-border1" />
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => editor.appendRow()}>
        <PlusIcon />
        {addLabel}
      </Button>
      <span aria-hidden="true" className="h-px flex-1 bg-border1" />
    </div>
  );
}

function EnvironmentVariablesEditorMessages<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  duplicateKeyMessage = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  error,
  showDuplicateKeys = true,
}: EnvironmentVariablesEditorMessagesProps<TRow>) {
  return (
    <>
      {showDuplicateKeys && editor.hasDuplicateKeys && (
        <Notice variant="destructive">
          <Notice.Message>{duplicateKeyMessage}</Notice.Message>
        </Notice>
      )}

      {error && (
        <Notice variant="destructive">
          <Notice.Message>{error}</Notice.Message>
        </Notice>
      )}
    </>
  );
}

function EnvironmentVariablesEditorActions({ className, ...props }: EnvironmentVariablesEditorActionsProps) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}

function EnvironmentVariablesEditorReadOnlyList({
  className,
  children,
  columns,
  header,
  showHeader = true,
  showIcon = false,
  nameLabel,
  valueLabel,
  updatedAtLabel,
  variant = 'lined',
  scrollRef,
}: EnvironmentVariablesEditorReadOnlyListProps) {
  const resolvedColumns = columns ?? (showIcon ? READ_ONLY_COLUMNS_WITH_ICON : READ_ONLY_COLUMNS);

  return (
    <EnvironmentVariablesEditorReadOnlyListContext.Provider value={{ showIcon }}>
      <DataList columns={resolvedColumns} variant={variant} scrollRef={scrollRef} className={cn('min-h-0', className)}>
        {showHeader &&
          (header ?? (
            <EnvironmentVariablesEditorReadOnlyHeader
              nameLabel={nameLabel}
              valueLabel={valueLabel}
              updatedAtLabel={updatedAtLabel}
            />
          ))}
        {children}
      </DataList>
    </EnvironmentVariablesEditorReadOnlyListContext.Provider>
  );
}

function EnvironmentVariablesEditorReadOnlyHeader({
  className,
  nameLabel = 'Key',
  valueLabel = 'Value',
  updatedAtLabel = 'Last Updated',
}: EnvironmentVariablesEditorReadOnlyHeaderProps) {
  const { showIcon } = useContext(EnvironmentVariablesEditorReadOnlyListContext);

  return (
    <DataList.Top className={className}>
      {showIcon && (
        <DataList.TopCell aria-hidden="true" className="justify-center">
          <span />
        </DataList.TopCell>
      )}
      <DataList.TopCell>{nameLabel}</DataList.TopCell>
      <DataList.TopCell>{valueLabel}</DataList.TopCell>
      <DataList.TopCell className="justify-end">{updatedAtLabel}</DataList.TopCell>
    </DataList.Top>
  );
}

function EnvironmentVariablesEditorReadOnlyEmpty({
  className,
  message = 'No environment variables found',
}: EnvironmentVariablesEditorReadOnlyEmptyProps) {
  return <DataList.NoMatch message={message} className={className} />;
}

function EnvironmentVariablesEditorReadOnlyItem({
  className,
  name,
  value,
  copyValue,
  copyLabel = 'Copy value',
  updatedAt,
  revealed,
  defaultRevealed,
  onRevealedChange,
  actor,
  icon,
  ...props
}: EnvironmentVariablesEditorReadOnlyItemProps) {
  const { showIcon } = useContext(EnvironmentVariablesEditorReadOnlyListContext);
  const [uncontrolledRevealed, setUncontrolledRevealed] = useState(defaultRevealed ?? false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });
  const isRevealed = revealed ?? uncontrolledRevealed;
  const displayedValue = isRevealed ? value : '************';
  const leadingIcon = icon ?? <Code2Icon />;
  const resolvedCopyValue = copyValue ?? getCopyableReadOnlyValue(value);
  const canCopyValue = isRevealed && Boolean(resolvedCopyValue);

  function toggleRevealed() {
    const nextRevealed = !isRevealed;

    if (revealed === undefined) {
      setUncontrolledRevealed(nextRevealed);
    }

    onRevealedChange?.(nextRevealed);
  }

  function handleCopyValue() {
    if (!resolvedCopyValue) return;

    copyToClipboard(resolvedCopyValue);
  }

  return (
    <DataList.RowStatic className={cn('min-h-14', className)} {...props}>
      {showIcon && (
        <DataList.Cell height="compact" className="justify-items-center overflow-visible">
          <span className="flex size-7 items-center justify-center rounded-full border border-border1 text-neutral3 [&>svg]:size-3.5">
            {leadingIcon}
          </span>
        </DataList.Cell>
      )}

      <DataList.Cell height="compact" className="min-w-0">
        <div className="min-w-0">
          <span className="truncate font-mono text-ui-sm text-neutral6">{name}</span>
        </div>
      </DataList.Cell>

      <DataList.Cell height="compact" className="min-w-0">
        {value !== undefined && (
          <span className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={isRevealed ? 'Hide value' : 'Show value'}
              onClick={toggleRevealed}
            >
              {isRevealed ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
            </Button>
            <span className="group relative flex min-w-0 flex-1 items-center">
              <span
                className={cn(
                  'block min-w-0 flex-1 truncate font-mono text-ui-xs text-neutral4',
                  canCopyValue && 'pr-7',
                )}
              >
                {displayedValue}
              </span>
              {canCopyValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={isCopied ? 'Copied value' : copyLabel}
                  tooltip={isCopied ? 'Copied' : copyLabel}
                  className="absolute right-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                  onClick={handleCopyValue}
                >
                  {isCopied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                </Button>
              )}
            </span>
          </span>
        )}
      </DataList.Cell>

      <DataList.Cell height="compact" className="min-w-0 justify-items-end text-ui-xs text-neutral3">
        {(updatedAt || actor) && (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{updatedAt}</span>
            {actor}
          </span>
        )}
      </DataList.Cell>
    </DataList.RowStatic>
  );
}

function getCopyableReadOnlyValue(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

export const EnvironmentVariablesEditor = Object.assign(EnvironmentVariablesEditorRoot, {
  Upload: EnvironmentVariablesEditorUpload,
  Rows: EnvironmentVariablesEditorRows,
  Row: EnvironmentVariablesEditorRow,
  AddButton: EnvironmentVariablesEditorAddButton,
  Messages: EnvironmentVariablesEditorMessages,
  Actions: EnvironmentVariablesEditorActions,
  ReadOnlyList: EnvironmentVariablesEditorReadOnlyList,
  ReadOnlyHeader: EnvironmentVariablesEditorReadOnlyHeader,
  ReadOnlyEmpty: EnvironmentVariablesEditorReadOnlyEmpty,
  ReadOnlyItem: EnvironmentVariablesEditorReadOnlyItem,
});
