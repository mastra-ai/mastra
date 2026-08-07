import { useMemo } from 'react';

import { EnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorContextValue } from './environment-variables-editor-context';
import { EnvironmentVariablesEditorPasteHint } from './environment-variables-editor-paste-hint';
import type { EnvironmentVariablesEditorRootProps } from './environment-variables-editor.types';
import type { EnvironmentVariableEntry } from '@/lib/env-file';

export function EnvironmentVariablesEditorRoot<TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry>({
  editor,
  className,
  children,
  disabled,
  readOnly,
  rowErrors,
  hidePasteHint,
  ...props
}: EnvironmentVariablesEditorRootProps<TRow>) {
  const contextValue = useMemo<EnvironmentVariablesEditorContextValue>(
    () => ({
      editor: {
        rows: editor.rows,
        uploadError: editor.uploadError,
        fileInputRef: editor.fileInputRef,
        hasDuplicateKeys: editor.hasDuplicateKeys,
        updateRow: editor.updateRow,
        removeRow: editor.removeRow,
        handleFileUpload: editor.handleFileUpload,
        handlePaste: editor.handlePaste,
        getRowId: editor.getRowId,
        isValueRevealed: editor.isValueRevealed,
        toggleValueVisibility: editor.toggleValueVisibility,
        rowHasDuplicateKey: editor.rowHasDuplicateKey,
        appendRow: () => editor.appendRow(),
      },
      disabled: Boolean(disabled),
      readOnly: Boolean(readOnly),
      rowErrors,
    }),
    [editor, disabled, readOnly, rowErrors],
  );

  return (
    <EnvironmentVariablesEditorContext.Provider value={contextValue}>
      <div className={className} {...props}>
        {children}
        {!readOnly && !hidePasteHint && <EnvironmentVariablesEditorPasteHint />}
      </div>
    </EnvironmentVariablesEditorContext.Provider>
  );
}
