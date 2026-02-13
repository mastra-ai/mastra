import { CopyIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon, IconProps } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';
import { Button, ButtonProps } from '../Button';
import { B } from 'node_modules/vitest/dist/chunks/config.d.CzIjkicf';

export type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  tooltip?: string;
  className?: string;
  iconSize?: IconProps['size'];
  size?: ButtonProps['size'];
};

export function CopyButton({
  content,
  copyMessage,
  tooltip = 'Copy to clipboard',
  iconSize = 'default',
  className,
  size = 'tiny',
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
          //    className={cn('rounded-lg p-1', transitions.all, focusRing.visible, 'hover:bg-surface4', className)}
          size={size}
          variant="standard"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : tooltip}</TooltipContent>
    </Tooltip>
  );
}
