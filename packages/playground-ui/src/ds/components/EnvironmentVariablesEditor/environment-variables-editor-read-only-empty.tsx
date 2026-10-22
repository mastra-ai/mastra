import { DataList } from '../DataList/data-list';
import type { EnvironmentVariablesEditorReadOnlyEmptyProps } from './environment-variables-editor.types';

export function EnvironmentVariablesEditorReadOnlyEmpty({
  message = 'No environment variables found',
  ...props
}: EnvironmentVariablesEditorReadOnlyEmptyProps) {
  return <DataList.NoMatch message={message} {...props} />;
}
