import { XIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFilterBarContext } from './filter-bar-context';
import { Button } from '@/ds/components/Button/Button';

export type FilterBarClearProps = {
  label?: string;
  className?: string;
};

/**
 * Removes every filter. Renders nothing while the bar is empty. Always sits at
 * the trailing edge of the bar, after the wrapping chip list, wherever it is
 * declared among the children.
 */
export function FilterBarClear({ label = 'Clear filters', className }: FilterBarClearProps) {
  const ctx = useFilterBarContext();
  if (ctx.items.length === 0 || !ctx.trailingSlot) return null;
  return createPortal(
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      tooltip={label}
      className={className}
      onClick={event => {
        event.stopPropagation();
        ctx.clear();
        ctx.focusInput();
      }}
    >
      <XIcon />
    </Button>,
    ctx.trailingSlot,
  );
}
