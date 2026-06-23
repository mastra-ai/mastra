import { EnvironmentVariablesEditorActions } from './environment-variables-editor-actions';
import { EnvironmentVariablesEditorAddButton } from './environment-variables-editor-add-button';
import { EnvironmentVariablesEditorDuplicateKeysError } from './environment-variables-editor-duplicate-keys-error';
import { EnvironmentVariablesEditorMessages } from './environment-variables-editor-messages';
import { EnvironmentVariablesEditorReadOnlyEmpty } from './environment-variables-editor-read-only-empty';
import { EnvironmentVariablesEditorReadOnlyHeader } from './environment-variables-editor-read-only-header';
import { EnvironmentVariablesEditorReadOnlyItem } from './environment-variables-editor-read-only-item';
import { EnvironmentVariablesEditorReadOnlyList } from './environment-variables-editor-read-only-list';
import { EnvironmentVariablesEditorRoot } from './environment-variables-editor-root';
import { EnvironmentVariablesEditorRow } from './environment-variables-editor-row';
import { EnvironmentVariablesEditorRows } from './environment-variables-editor-rows';
import { EnvironmentVariablesEditorUpload } from './environment-variables-editor-upload';
import { EnvironmentVariablesEditorUploadButton } from './environment-variables-editor-upload-button';
import { EnvironmentVariablesEditorUploadError } from './environment-variables-editor-upload-error';
import type { EnvironmentVariablesEditorProps } from './environment-variables-editor.types';
import type { EnvironmentVariableEntry } from '@/lib/env-file';
import { DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE } from '@/lib/env-file';
import { cn } from '@/lib/utils';

const renderEnvironmentVariablesEditor = <TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  className,
  children,
  addLabel = 'Add Variable',
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  duplicateKeyMessage = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  rowErrors,
  error,
  actions,
  ...props
}: EnvironmentVariablesEditorProps<TRow>) => {
  return (
    <EnvironmentVariablesEditorRoot
      className={cn(!children && 'space-y-3', className)}
      rowErrors={rowErrors}
      {...props}
    >
      {children ?? (
        <>
          <EnvironmentVariablesEditorUpload>
            <EnvironmentVariablesEditorUploadButton />
          </EnvironmentVariablesEditorUpload>
          <EnvironmentVariablesEditorUploadError />
          <EnvironmentVariablesEditorRows
            rowErrors={rowErrors}
            keyLabel={keyLabel}
            valueLabel={valueLabel}
            keyPlaceholder={keyPlaceholder}
            valuePlaceholder={valuePlaceholder}
            duplicateKeyMessage={duplicateKeyMessage}
          />
          <EnvironmentVariablesEditorAddButton>{addLabel}</EnvironmentVariablesEditorAddButton>
          <EnvironmentVariablesEditorDuplicateKeysError message={duplicateKeyMessage} />
          <EnvironmentVariablesEditorMessages error={error} />
          {actions && <EnvironmentVariablesEditorActions>{actions}</EnvironmentVariablesEditorActions>}
        </>
      )}
    </EnvironmentVariablesEditorRoot>
  );
};

export const EnvironmentVariablesEditor = Object.assign(renderEnvironmentVariablesEditor, {
  Root: EnvironmentVariablesEditorRoot,
  Upload: EnvironmentVariablesEditorUpload,
  UploadButton: EnvironmentVariablesEditorUploadButton,
  UploadError: EnvironmentVariablesEditorUploadError,
  Rows: EnvironmentVariablesEditorRows,
  Row: EnvironmentVariablesEditorRow,
  AddButton: EnvironmentVariablesEditorAddButton,
  Messages: EnvironmentVariablesEditorMessages,
  DuplicateKeysError: EnvironmentVariablesEditorDuplicateKeysError,
  Actions: EnvironmentVariablesEditorActions,
  ReadOnlyList: EnvironmentVariablesEditorReadOnlyList,
  ReadOnlyHeader: EnvironmentVariablesEditorReadOnlyHeader,
  ReadOnlyEmpty: EnvironmentVariablesEditorReadOnlyEmpty,
  ReadOnlyItem: EnvironmentVariablesEditorReadOnlyItem,
});

export type {
  EnvironmentVariablesEditorActionsProps,
  EnvironmentVariablesEditorAddButtonProps,
  EnvironmentVariablesEditorDuplicateKeysErrorProps,
  EnvironmentVariablesEditorMessagesProps,
  EnvironmentVariablesEditorProps,
  EnvironmentVariablesEditorReadOnlyEmptyProps,
  EnvironmentVariablesEditorReadOnlyHeaderProps,
  EnvironmentVariablesEditorReadOnlyItemProps,
  EnvironmentVariablesEditorReadOnlyListProps,
  EnvironmentVariablesEditorRootProps,
  EnvironmentVariablesEditorRowErrors,
  EnvironmentVariablesEditorRowProps,
  EnvironmentVariablesEditorRowsProps,
  EnvironmentVariablesEditorUploadButtonProps,
  EnvironmentVariablesEditorUploadErrorProps,
  EnvironmentVariablesEditorUploadProps,
} from './environment-variables-editor.types';
