import { XIcon } from 'lucide-react';
import { useFilterBarContext } from './filter-bar-context';
import { Button } from '@/ds/components/Button/Button';

/** Removes every filter. Rendered by FilterBar at its trailing edge; hidden while the bar is empty. */
export function FilterBarClear({ label }: { label: string }) {
  const ctx = useFilterBarContext();
  if (ctx.items.length === 0) return null;
  return (
    <Button
      variant="ghost"
      size="icon-xs"
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
