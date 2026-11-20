import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { useLinkComponent } from '@/lib/framework';

/** Studio's Edit / Share / Config header controls, with host-owned actions. */
export function AgentHeaderActions({
  editHref,
  onShare,
  isShareCopied,
  shareLabel = 'Copy session URL',
  shareTooltip = 'Copy session URL to share with your team',
  configToggle,
}: {
  editHref?: string;
  onShare?: () => void;
  isShareCopied?: boolean;
  shareLabel?: string;
  shareTooltip?: string;
  configToggle?: ReactNode;
}) {
  const { Link } = useLinkComponent();
  return (
    <>
      {editHref && (
        <Button variant="ghost" size="sm" render={<Link href={editHref} />} icon={<IconPencil />}>
          Edit
        </Button>
      )}
      {onShare && (
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={shareLabel}
          onClick={onShare}
          tooltip={shareTooltip}
          data-testid="agent-entity-header-share"
        >
          {isShareCopied ? <IconCheckmark2Medium /> : <IconChainLink3 />}
        </Button>
      )}
      {configToggle}
    </>
  );
}
