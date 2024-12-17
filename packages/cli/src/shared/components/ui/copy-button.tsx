'use client';

import { Check, Copy } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { cn } from '../../lib/utils';

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
    <Button
      variant="ghost"
      size="icon"
      className={cn('relative h-6 w-6', classname)}
      aria-label="Copy to clipboard"
      onClick={handleCopy}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Check className={cn('h-4 w-4 transition-transform ease-in-out', isCopied ? 'scale-100' : 'scale-0')} />
      </div>
      <Copy className={cn('h-4 w-4 transition-transform ease-in-out', isCopied ? 'scale-0' : 'scale-100')} />
    </Button>
  );
}
