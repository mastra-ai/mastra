import { PlusIcon } from 'lucide-react';

import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorAddButtonProps } from './environment-variables-editor.types';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorAddButton({
  className,
  children,
  ...props
}: EnvironmentVariablesEditorAddButtonProps) {
  const { editor, disabled, readOnly } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.AddButton');

  if (readOnly) return null;

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <span aria-hidden="true" className="bg-border1 h-px flex-1" />
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => editor.appendRow()}>
        <PlusIcon />
        {children ?? 'Add Variable'}
      </Button>
      <span aria-hidden="true" className="bg-border1 h-px flex-1" />
    </div>
  );
}
