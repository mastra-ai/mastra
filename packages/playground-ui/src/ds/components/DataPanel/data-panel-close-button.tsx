import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface DataPanelCloseButtonProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
  variant?: ButtonProps['variant'];
}

/** Leading "leave this panel" arrow; render it as the first child of `DataPanel.Header`. */
export function DataPanelCloseButton({
  onClick,
  tooltip = 'Close panel',
  className,
  variant = 'ghost',
}: DataPanelCloseButtonProps) {
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={onClick}
      aria-label="Close Panel"
      tooltip={tooltip}
      className={cn('shrink-0', className)}
    >
      <ArrowLeftIcon />
    </Button>
  );
}
