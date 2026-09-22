import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { truncateString } from '@/lib/truncate-string';

export interface DataPanelCopyIdProps {
  id: string;
  /** Characters kept before the ellipsis. Defaults to 12. */
  maxLength?: number;
}

/**
 * Truncated identifier rendered inline in a `DataPanel.Heading`; clicking copies the full value.
 */
export function DataPanelCopyId({ id, maxLength = 12 }: DataPanelCopyIdProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: id, showToast: false });
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={isCopied || open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            {truncateString(id, maxLength)}
          </Button>
        }
      />
      <TooltipContent>{isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}</TooltipContent>
    </Tooltip>
  );
}
