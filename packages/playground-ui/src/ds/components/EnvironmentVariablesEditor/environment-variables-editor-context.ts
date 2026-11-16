import { createContext, use } from 'react';

import type { EnvironmentVariablesEditorRowErrors } from './environment-variables-editor.types';
import type { EnvironmentVariablesEditorController } from '@/hooks/use-environment-variables-editor';

type EnvironmentVariablesEditorRenderController = Pick<
  EnvironmentVariablesEditorController,
  | 'rows'
  | 'uploadError'
  | 'fileInputRef'
  | 'hasDuplicateKeys'
  | 'updateRow'
  | 'removeRow'
  | 'handleFileUpload'
  | 'handlePaste'
  | 'getRowId'
  | 'isValueRevealed'
  | 'toggleValueVisibility'
  | 'rowHasDuplicateKey'
> & {
  appendRow: () => void;
};

export interface EnvironmentVariablesEditorContextValue {
  editor: EnvironmentVariablesEditorRenderController;
  disabled: boolean;
  readOnly: boolean;
  rowErrors?: EnvironmentVariablesEditorRowErrors;
}

export const EnvironmentVariablesEditorContext = createContext<EnvironmentVariablesEditorContextValue | null>(null);

export const EnvironmentVariablesEditorReadOnlyListContext = createContext({
  showIcon: false,
});

export function useEnvironmentVariablesEditorContext(componentName: string) {
  const context = use(EnvironmentVariablesEditorContext);

  if (!context) {
    throw new Error(`${componentName} must be used within EnvironmentVariablesEditor.Root`);
  }

  return context;
}
