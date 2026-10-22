import { XIcon } from 'lucide-react';
import { Button } from '../Button/Button';
import { useFilterBarContext } from './filter-bar-context';

/** Removes every removable filter. Rendered by FilterBar at its trailing edge; hidden while nothing can be removed. */
export function FilterBarClear({ label }: { label: string }) {
  const ctx = useFilterBarContext();
  if (!ctx.hasRemovableItems) return null;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      tooltip={label}
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
