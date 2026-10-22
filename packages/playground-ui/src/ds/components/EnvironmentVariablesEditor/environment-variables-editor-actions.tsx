import { cn } from '../../../lib/utils';
import type { EnvironmentVariablesEditorActionsProps } from './environment-variables-editor.types';

export function EnvironmentVariablesEditorActions({ className, ...props }: EnvironmentVariablesEditorActionsProps) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}
