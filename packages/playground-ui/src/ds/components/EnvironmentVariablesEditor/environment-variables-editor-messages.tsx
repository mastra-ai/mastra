import type { EnvironmentVariablesEditorMessagesProps } from './environment-variables-editor.types';
import { Notice } from '@/ds/components/Notice';

export function EnvironmentVariablesEditorMessages({
  error,
  children,
  variant = 'destructive',
  ...props
}: EnvironmentVariablesEditorMessagesProps) {
  const message = children ?? error;

  if (!message) return null;

  return (
    <Notice variant={variant} {...props}>
      <Notice.Message>{message}</Notice.Message>
    </Notice>
  );
}
