import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface DataPanelCloseButtonProps {
  onClick: () => void;
  tooltip?: string;
  /** Accessible name; override it when the arrow leads somewhere other than "closed" (e.g. back to a parent view). */
  label?: string;
  /**
   * `arrow` (default) is the leading "leave this panel" control, rendered first in the header.
   * `x` dismisses a nested column in place and belongs in `HeaderActions`, on the right.
   */
  icon?: 'arrow' | 'x';
  className?: string;
  variant?: ButtonProps['variant'];
}

export function DataPanelCloseButton({
  onClick,
  tooltip = 'Close panel',
  label = 'Close Panel',
  icon = 'arrow',
  className,
  variant = 'ghost',
}: DataPanelCloseButtonProps) {
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={onClick}
      aria-label={label}
      tooltip={tooltip}
      className={cn('shrink-0', className)}
    >
      {icon === 'x' ? <XIcon /> : <ArrowLeftIcon />}
    </Button>
  );
}
