'use client';

import { CopyIcon } from 'lucide-react';

import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';

import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { Icon } from '@mastra/playground-ui';

type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  tooltip?: string;
};

export function CopyButton({ content, copyMessage, tooltip = 'Copy to clipboard' }: CopyButtonProps) {
  const { handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={handleCopy} type="button">
          <Icon className="transition-colors hover:bg-surface4 rounded-lg text-icon3 hover:text-icon6">
            <CopyIcon />
          </Icon>
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
