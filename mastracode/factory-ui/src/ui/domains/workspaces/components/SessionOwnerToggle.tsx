import { Button } from '@mastra/playground-ui/components/Button';
import { UserRound, UsersRound } from 'lucide-react';

/**
 * The one-click owner cut for a sessions list: just the viewer's own sessions, or everyone's.
 * The user-session list carries the full filter popover, but the work and review lists only
 * need this distinction, so it lives on the section heading as a single toggle rather than a
 * second popover. The narrowed list is the default, so the toggle stays quiet and its icon names
 * the current scope instead of filling in like an applied filter.
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
  // The name stays fixed and aria-pressed carries the state; only the tooltip names the next click.
  const actionLabel = mineOnly ? `Show all ${label}` : `Show only my ${label}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Show only my ${label}`}
      aria-pressed={mineOnly}
      tooltip={actionLabel}
      onClick={() => onChange(!mineOnly)}
    >
      {mineOnly ? <UserRound size={15} /> : <UsersRound size={15} />}
    </Button>
  );
}
