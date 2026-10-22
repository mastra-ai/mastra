import { cn } from '../../../lib/utils';
import { Txt } from '../Txt';
import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorPasteHintProps } from './environment-variables-editor.types';

export const DEFAULT_ENVIRONMENT_VARIABLE_PASTE_HINT = 'Tip: paste a .env file into any field to import it';

export function EnvironmentVariablesEditorPasteHint({
  className,
  children,
  ...props
}: EnvironmentVariablesEditorPasteHintProps) {
  const { readOnly } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.PasteHint');

  if (readOnly) return null;

  return (
    <Txt as="p" variant="meta" tone="muted" className={cn('text-right', className)} {...props}>
      {children ?? DEFAULT_ENVIRONMENT_VARIABLE_PASTE_HINT}
    </Txt>
  );
}
