import { CheckIcon, Code2Icon, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { use, useState } from 'react';
import type { ReactNode } from 'react';

import { EnvironmentVariablesEditorReadOnlyListContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorReadOnlyItemProps } from './environment-variables-editor.types';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList/data-list';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

export function EnvironmentVariablesEditorReadOnlyItem({
  className,
  name,
  value,
  copyValue,
  copyLabel = 'Copy value',
  updatedAt,
  revealed,
  defaultRevealed,
  onRevealedChange,
  actor,
  icon,
  ...props
}: EnvironmentVariablesEditorReadOnlyItemProps) {
  const { showIcon } = use(EnvironmentVariablesEditorReadOnlyListContext);
  const [uncontrolledRevealed, setUncontrolledRevealed] = useState(defaultRevealed ?? false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });
  const isRevealed = revealed ?? uncontrolledRevealed;
  const displayedValue = isRevealed ? value : '************';
  const leadingIcon = icon ?? <Code2Icon />;
  const resolvedCopyValue = copyValue ?? getCopyableReadOnlyValue(value);
  const canCopyValue = isRevealed && Boolean(resolvedCopyValue);

  function toggleRevealed() {
    const nextRevealed = !isRevealed;

    if (revealed === undefined) {
      setUncontrolledRevealed(nextRevealed);
    }

    onRevealedChange?.(nextRevealed);
  }

  function handleCopyValue() {
    if (!resolvedCopyValue) return;

    copyToClipboard(resolvedCopyValue);
  }

  return (
    <DataList.RowStatic className={cn('min-h-14', className)} {...props}>
      {showIcon && (
        <DataList.Cell height="compact" className="justify-items-center overflow-visible">
          <span className="flex size-7 items-center justify-center rounded-full border border-border1 text-neutral3 [&>svg]:size-3.5">
            {leadingIcon}
          </span>
        </DataList.Cell>
      )}

      <DataList.MonoCell height="compact" className="text-ui-sm text-neutral6">
        {name}
      </DataList.MonoCell>

      <DataList.Cell height="compact" className="min-w-0">
        {value !== undefined && (
          <span className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={isRevealed ? 'Hide value' : 'Show value'}
              onClick={toggleRevealed}
            >
              {isRevealed ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
            </Button>
            <span className="group relative flex min-w-0 flex-1 items-center">
              <span
                className={cn(
                  'block min-w-0 flex-1 truncate font-mono text-ui-xs text-neutral4',
                  canCopyValue && 'pr-7',
                )}
              >
                {displayedValue}
              </span>
              {canCopyValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={isCopied ? 'Copied value' : copyLabel}
                  tooltip={isCopied ? 'Copied' : copyLabel}
                  className="absolute right-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                  onClick={handleCopyValue}
                >
                  {isCopied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                </Button>
              )}
            </span>
          </span>
        )}
      </DataList.Cell>

      <DataList.Cell height="compact" className="min-w-0 justify-items-end text-ui-xs text-neutral3">
        {(updatedAt || actor) && (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{updatedAt}</span>
            {actor}
          </span>
        )}
      </DataList.Cell>
    </DataList.RowStatic>
  );
}

function getCopyableReadOnlyValue(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return undefined;
}
