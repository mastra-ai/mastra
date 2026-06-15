import { XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export interface DataPanelCloseButtonProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

export function DataPanelCloseButton({ onClick, tooltip = 'Close panel', className }: DataPanelCloseButtonProps) {
  return (
    <Button size="md" onClick={onClick} aria-label="Close Panel" tooltip={tooltip} className={className}>
      <XIcon />
    </Button>
  );
}
