import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorPasteHintProps } from './environment-variables-editor.types';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export const DEFAULT_ENVIRONMENT_VARIABLE_PASTE_HINT = 'Tip: paste a .env file into any field to import it';

export function EnvironmentVariablesEditorPasteHint({
  className,
  children,
  ...props
}: EnvironmentVariablesEditorPasteHintProps) {
  const { readOnly } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.PasteHint');

  if (readOnly) return null;

  return (
    <Txt as="p" variant="ui-xs" className={cn('text-right text-neutral4', className)} {...props}>
      {children ?? DEFAULT_ENVIRONMENT_VARIABLE_PASTE_HINT}
    </Txt>
  );
}
