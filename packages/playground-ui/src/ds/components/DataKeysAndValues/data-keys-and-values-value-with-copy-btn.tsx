import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dataKeysAndValuesValueStyles } from './shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueWithCopyBtnProps {
  className?: string;
  children: React.ReactNode;
  copyValue: string;
}

export function DataKeysAndValuesValueWithCopyBtn({
  className,
  children,
  copyValue,
}: DataKeysAndValuesValueWithCopyBtnProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { handleCopy: originalHandleCopy } = useCopyToClipboard({
    text: copyValue,
    copyMessage: 'Copied!',
  });

  const handleCopy = () => {
    originalHandleCopy();
    setCopied(true);
    clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)}>
      <Tooltip open={copied || undefined}>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            type="button"
            className={cn(
              'flex gap-2 items-center',
              '[&>svg]:w-3 [&>svg]:h-3 [&>svg]:shrink-0 [&>svg]:opacity-70 [&:hover>svg]:opacity-100',
              { '[&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-accent1': copied },
              className,
            )}
            aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            <span>{children}</span>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
      </Tooltip>
    </dd>
  );
}
