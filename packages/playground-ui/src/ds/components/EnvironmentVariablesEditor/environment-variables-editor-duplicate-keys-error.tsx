import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import { EnvironmentVariablesEditorMessages } from './environment-variables-editor-messages';
import type { EnvironmentVariablesEditorDuplicateKeysErrorProps } from './environment-variables-editor.types';
import { DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE } from '@/lib/env-file';

export function EnvironmentVariablesEditorDuplicateKeysError({
  message = DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  ...props
}: EnvironmentVariablesEditorDuplicateKeysErrorProps) {
  const { editor } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.DuplicateKeysError');

  if (!editor.hasDuplicateKeys) return null;

  return <EnvironmentVariablesEditorMessages error={message} {...props} />;
}
