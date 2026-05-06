import { XIcon } from 'lucide-react';
import { ButtonWithTooltip } from '@/ds/components/Button/ButtonWithTooltip';

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
    <ButtonWithTooltip
      size="md"
      onClick={onClick}
      aria-label="Close Panel"
      tooltipContent={tooltip}
      className={className}
    >
      <XIcon />
    </ButtonWithTooltip>
  );
}
