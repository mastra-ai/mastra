import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { truncateString } from '@/lib/truncate-string';

export function TraceIdButton({ id }: { id: string }) {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: id, showToast: false });
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={isCopied || open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            {truncateString(id, 12)}
          </Button>
        }
      />
      <TooltipContent>{isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}</TooltipContent>
    </Tooltip>
  );
}
