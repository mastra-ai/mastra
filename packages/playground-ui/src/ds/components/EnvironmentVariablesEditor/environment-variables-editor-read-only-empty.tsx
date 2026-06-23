import type { EnvironmentVariablesEditorReadOnlyEmptyProps } from './environment-variables-editor.types';
import { DataList } from '@/ds/components/DataList/data-list';

export function EnvironmentVariablesEditorReadOnlyEmpty({
  message = 'No environment variables found',
  ...props
}: EnvironmentVariablesEditorReadOnlyEmptyProps) {
  return <DataList.NoMatch message={message} {...props} />;
}

