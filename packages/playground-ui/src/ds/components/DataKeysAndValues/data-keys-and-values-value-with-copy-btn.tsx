import { CheckIcon, CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '../../../hooks/use-copy-to-clipboard';
import { cn } from '../../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { dataKeysAndValuesValueStyles } from './shared';

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
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: copyValue,
    copyMessage: 'Copied!',
  });

  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)}>
      <Tooltip open={isCopied || undefined}>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            type="button"
            className={cn(
              'flex items-center gap-2 text-left whitespace-nowrap',
              '[&:hover>svg]:opacity-100 [&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:opacity-70',
              { '[&>svg]:size-4 [&>svg]:text-success-indicator': isCopied },
            )}
            aria-label={isCopied ? 'Copied!' : copyTooltip}
          >
            <span>{children}</span>
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isCopied ? 'Copied!' : copyTooltip}</TooltipContent>
      </Tooltip>
    </dd>
  );
}
