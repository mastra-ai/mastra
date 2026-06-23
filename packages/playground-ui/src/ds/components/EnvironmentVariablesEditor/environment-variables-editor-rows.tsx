import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import { EnvironmentVariablesEditorRow } from './environment-variables-editor-row';
import type { EnvironmentVariablesEditorRowsProps } from './environment-variables-editor.types';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorRows({
  className,
  rowErrors,
  keyLabel,
  valueLabel,
  keyPlaceholder,
  valuePlaceholder,
  duplicateKeyMessage,
  ...props
}: EnvironmentVariablesEditorRowsProps) {
  const { editor, rowErrors: contextRowErrors } = useEnvironmentVariablesEditorContext(
    'EnvironmentVariablesEditor.Rows',
  );
  const resolvedRowErrors = rowErrors ?? contextRowErrors;

  return (
    <div className={cn('space-y-2', className)} {...props}>
      {editor.rows.map((row, index) => (
        <EnvironmentVariablesEditorRow
          key={editor.getRowId(index)}
          row={row}
          index={index}
          rowErrors={resolvedRowErrors}
          keyLabel={keyLabel}
          valueLabel={valueLabel}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          duplicateKeyMessage={duplicateKeyMessage}
        />
      ))}
    </div>
  );
}

