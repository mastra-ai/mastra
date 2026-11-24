import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { CopyIcon, CopyTooltip } from '@/ds/components/CopyButton';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import type { CopyStatus } from '@/hooks/use-copy-to-clipboard';
import { useLinkComponent } from '@/lib/framework';

/** Studio's Edit / Share / Config header controls, with host-owned actions. */
export function AgentHeaderActions({
  editHref,
  onShare,
  shareStatus,
  isShareCopied,
  shareLabel = 'Copy session URL',
  shareTooltip = 'Copy session URL to share with your team',
  configToggle,
}: {
  editHref?: string;
  onShare?: () => void;
  /** What the copy `onShare` made did. */
  shareStatus?: CopyStatus;
  /** @deprecated Use `shareStatus`, which also says a copy that failed. */
  isShareCopied?: boolean;
  shareLabel?: string;
  shareTooltip?: string;
  configToggle?: ReactNode;
}) {
  const { Link } = useLinkComponent();
  const copyStatus = shareStatus ?? (isShareCopied ? 'copied' : 'idle');
  return (
    <>
      {editHref && (
        <Button variant="ghost" size="sm" render={<Link href={editHref} />} icon={<IconPencil />}>
          Edit
        </Button>
      )}
      {onShare && (
        <CopyTooltip status={copyStatus} label={shareTooltip}>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={shareLabel}
            onClick={onShare}
            data-testid="agent-entity-header-share"
          >
            <CopyIcon status={copyStatus} icon={<IconChainLink3 />} />
          </Button>
        </CopyTooltip>
      )}
      {configToggle}
    </>
  );
}
