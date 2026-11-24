import { Button } from '@/ds/components/Button';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export interface DataDetailsPanelCloseButtonProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

export function DataDetailsPanelCloseButton({
  onClick,
  tooltip = 'Close panel',
  className,
}: DataDetailsPanelCloseButtonProps) {
  return (
    <Button size="icon-md" onClick={onClick} aria-label="Close panel" tooltip={tooltip} className={className}>
      <IconCrossMedium />
    </Button>
  );
}
