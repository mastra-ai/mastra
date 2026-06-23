import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import { EnvironmentVariablesEditorMessages } from './environment-variables-editor-messages';
import type { EnvironmentVariablesEditorUploadErrorProps } from './environment-variables-editor.types';

export function EnvironmentVariablesEditorUploadError(props: EnvironmentVariablesEditorUploadErrorProps) {
  const { editor } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.UploadError');

  if (!editor.uploadError) return null;

  return <EnvironmentVariablesEditorMessages error={editor.uploadError} {...props} />;
}

