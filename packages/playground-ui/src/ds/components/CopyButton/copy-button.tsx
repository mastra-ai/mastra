import { CopyIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon, IconProps } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';

export type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  tooltip?: string;
  className?: string;
  iconSize?: IconProps['size'];
};

export function CopyButton({
  content,
  copyMessage,
  tooltip = 'Copy to clipboard',
  iconSize = 'default',
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
        <button
          onClick={handleCopy}
          type="button"
          className={cn('rounded-lg p-1', transitions.all, focusRing.visible, 'hover:bg-surface4', className)}
        >
          <Icon
            className={cn('text-neutral3', transitions.all, 'hover:text-neutral6', copied && 'text-accent1')}
            size={iconSize}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Icon>
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : tooltip}</TooltipContent>
    </Tooltip>
  );
}
