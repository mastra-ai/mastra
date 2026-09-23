import { Button } from '@mastra/playground-ui/components/Button';
import { ListFilter } from 'lucide-react';

/**
 * The one-click owner cut for a sessions list: everything, or just the viewer's own sessions.
 * The user-session list carries the full filter popover, but the work and review lists only
 * need this distinction, so it lives on the section heading as a single toggle rather than a
 * second popover. Filled while it is on, so the narrowed list never reads as the whole list.
 */
export function SessionOwnerToggle({
  label,
  mineOnly,
  onChange,
}: {
  /** What the toggle filters, e.g. `work sessions` — keeps the two section headings distinct. */
  label: string;
  mineOnly: boolean;
  onChange: (mineOnly: boolean) => void;
}) {
  const actionLabel = mineOnly ? `Show all ${label}` : `Show only my ${label}`;

  return (
    <Button
      type="button"
      variant={mineOnly ? 'default' : 'ghost'}
      size="icon-sm"
      aria-label={actionLabel}
      aria-pressed={mineOnly}
      tooltip={actionLabel}
      onClick={() => onChange(!mineOnly)}
    >
      <ListFilter size={15} />
    </Button>
  );
}
