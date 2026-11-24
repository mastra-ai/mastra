import { Button } from '@/ds/components/Button';
import { CopyIcon, CopyTooltip } from '@/ds/components/CopyButton';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { truncateString } from '@/lib/truncate-string';

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
  const { status, handleCopy } = useCopyToClipboard({ text: id });

  return (
    <CopyTooltip status={status} label="Copy to clipboard" openOnCopy>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={icon && <CopyIcon status={status} icon={icon} />}
        onClick={handleCopy}
      >
        {ellipsis ? truncateString(id, maxLength) : id.slice(0, maxLength)}
      </Button>
    </CopyTooltip>
  );
}
