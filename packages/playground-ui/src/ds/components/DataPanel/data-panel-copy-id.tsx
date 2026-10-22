import { useState } from 'react';
import { useCopyToClipboard } from '../../../hooks/use-copy-to-clipboard';
import { truncateString } from '../../../lib/truncate-string';
import { Button } from '../Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';

export interface DataPanelCopyIdProps {
  id: string;
  /** Characters kept when the id is truncated. Defaults to 12. */
  maxLength?: number;
  /** Append `…` to a truncated id. Defaults to true. */
  ellipsis?: boolean;
  /** Leading icon (bare SVG) naming what the id identifies. */
  icon?: React.ReactNode;
}

/**
 * Truncated identifier rendered inline in a `DataPanel.Heading`; clicking copies the full value.
 */
export function DataPanelCopyId({ id, maxLength = 12, ellipsis = true, icon }: DataPanelCopyIdProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: id, showToast: false });
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={isCopied || open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button type="button" variant="ghost" size="sm" icon={icon} onClick={handleCopy}>
            {ellipsis ? truncateString(id, maxLength) : id.slice(0, maxLength)}
          </Button>
        }
      />
      <TooltipContent>{isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}</TooltipContent>
    </Tooltip>
  );
}
