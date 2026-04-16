import { CopyIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';

import type { ButtonProps } from '../Button';
import { Button } from '../Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  tooltip?: string;
  className?: string;
  size?: ButtonProps['size'];
};

export function CopyButton({
  content,
  copyMessage,
  tooltip = 'Copy to clipboard',
  size = 'sm',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { handleCopy: originalHandleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  });

  const handleCopy = () => {
    originalHandleCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleCopy}
          type="button"
          size={size}
          className={className}
          aria-label={copied ? 'Copied!' : tooltip}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : tooltip}</TooltipContent>
    </Tooltip>
  );
}
