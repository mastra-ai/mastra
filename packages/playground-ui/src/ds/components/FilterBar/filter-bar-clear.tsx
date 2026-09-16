import { XIcon } from 'lucide-react';
import { useFilterBarContext } from './filter-bar-context';
import { Button } from '@/ds/components/Button/Button';

export type FilterBarClearProps = {
  label?: string;
  className?: string;
};

/** Removes every filter. Renders nothing while the bar is empty. */
export function FilterBarClear({ label = 'Clear filters', className }: FilterBarClearProps) {
  const ctx = useFilterBarContext();
  if (ctx.items.length === 0) return null;
  return (
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
    </Button>
  );
}
