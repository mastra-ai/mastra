import { Check, Copy } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

import { useCopyToClipboard } from './hooks/use-copy-to-clipboard';

type CopyButtonProps = {
  content: string;
  copyMessage?: string;
  classname?: string;
};

export function CopyButton({ content, copyMessage, classname }: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  });

  return (
    <button className={cn('relative h-6 w-6', classname)} aria-label="Copy to clipboard" onClick={handleCopy}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Check className={cn('h-4 w-4 transition-transform ease-in-out', isCopied ? 'scale-100' : 'scale-0')} />
      </div>
      <Copy className={cn('h-4 w-4 transition-transform ease-in-out', isCopied ? 'scale-0' : 'scale-100')} />
    </button>
  );
}
