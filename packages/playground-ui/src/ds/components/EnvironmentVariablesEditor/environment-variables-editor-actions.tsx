import type { EnvironmentVariablesEditorActionsProps } from './environment-variables-editor.types';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorActions({ className, ...props }: EnvironmentVariablesEditorActionsProps) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}
