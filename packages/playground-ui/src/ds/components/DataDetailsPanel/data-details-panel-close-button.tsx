import { XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';

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
    <Button size="md" onClick={onClick} aria-label="Close Panel" tooltip={tooltip} className={className}>
      <XIcon />
    </Button>
  );
}
