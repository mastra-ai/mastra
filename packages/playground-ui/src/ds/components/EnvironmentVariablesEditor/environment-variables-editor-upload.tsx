import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import { EnvironmentVariablesEditorUploadButton } from './environment-variables-editor-upload-button';
import type { EnvironmentVariablesEditorUploadProps } from './environment-variables-editor.types';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorUpload({
  className,
  children,
  ...props
}: EnvironmentVariablesEditorUploadProps) {
  const { readOnly } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.Upload');

  if (readOnly) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)} {...props}>
      {children ?? <EnvironmentVariablesEditorUploadButton />}
    </div>
  );
}
