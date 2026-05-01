import { CheckIcon, CopyIcon } from 'lucide-react';
import { dataKeysAndValuesValueStyles } from './shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
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
              'flex gap-2 items-center text-left whitespace-nowrap',
              '[&>svg]:w-3 [&>svg]:h-3 [&>svg]:shrink-0 [&>svg]:opacity-70 [&:hover>svg]:opacity-100',
              { '[&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-accent1': isCopied },
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
