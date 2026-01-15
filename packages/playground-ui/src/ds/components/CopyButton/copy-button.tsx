import { CopyIcon } from 'lucide-react';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon, IconProps } from '@/ds/icons';

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
  const { handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={handleCopy} type="button" className={className}>
          <Icon
            className="transition-colors hover:bg-surface4 rounded-lg text-neutral3 hover:text-neutral6"
            size={iconSize}
          >
            <CopyIcon />
          </Icon>
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
