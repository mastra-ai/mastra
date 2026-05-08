import { XIcon } from 'lucide-react';
import { ButtonWithTooltip } from '@/ds/components/Button/ButtonWithTooltip';

export interface DataPanelCloseButtonProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

export function DataPanelCloseButton({ onClick, tooltip = 'Close panel', className }: DataPanelCloseButtonProps) {
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
