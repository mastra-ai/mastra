import { XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';

export interface DataPanelCloseButtonProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
  variant?: ButtonProps['variant'];
}

export function DataPanelCloseButton({
  onClick,
  tooltip = 'Close panel',
  className,
  variant,
}: DataPanelCloseButtonProps) {
  return (
    <Button
      size="md"
      variant={variant}
      onClick={onClick}
      aria-label="Close Panel"
      tooltip={tooltip}
      className={className}
    >
      <XIcon />
    </Button>
  );
}
