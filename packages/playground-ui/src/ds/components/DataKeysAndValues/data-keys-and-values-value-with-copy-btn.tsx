import { dataKeysAndValuesValueStyles } from './shared';
import { CopyIcon, CopyTooltip } from '@/ds/components/CopyButton';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueWithCopyBtnProps {
  className?: string;
  children: React.ReactNode;
  copyValue: string;
  copyTooltip?: string;
}

export function DataKeysAndValuesValueWithCopyBtn({
  className,
  children,
  copyValue,
  copyTooltip = 'Copy to clipboard',
}: DataKeysAndValuesValueWithCopyBtnProps) {
  const { status, handleCopy } = useCopyToClipboard({ text: copyValue });

  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)}>
      <CopyTooltip status={status} label={copyTooltip}>
        <button
          onClick={handleCopy}
          type="button"
          className={cn(
            'flex max-w-full items-center gap-2 text-left whitespace-nowrap',
            '[&:hover>svg]:opacity-100 [&>svg]:size-icon-xs [&>svg]:shrink-0 [&>svg]:opacity-70',
          )}
          aria-label={copyTooltip}
        >
          <span className="min-w-0 truncate">{children}</span>
          <CopyIcon status={status} />
        </button>
      </CopyTooltip>
    </dd>
  );
}
