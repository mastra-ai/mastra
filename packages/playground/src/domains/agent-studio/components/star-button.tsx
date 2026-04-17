import { StarIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

import { useToggleStar } from '../hooks/use-user-preferences';
import { cn } from '@/lib/utils';

export interface StarButtonProps {
  kind: 'agent' | 'skill';
  id: string;
  className?: string;
  /** When true, the button is rendered only if the user is authenticated. */
  requireAuth?: boolean;
}

/**
 * Round star toggle for marketplace items. Optimistically updates the
 * user's preferences via `useToggleStar`. Designed to be safely nested
 * inside a card `<Link>` — click + key events stop propagation.
 */
export function StarButton({ kind, id, className, requireAuth = true }: StarButtonProps) {
  const { isStarred, toggle, canStar } = useToggleStar(kind, id);

  if (requireAuth && !canStar) return null;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void toggle();
  };

  return (
    <button
      type="button"
      aria-pressed={isStarred}
      aria-label={isStarred ? `Unstar ${kind}` : `Star ${kind}`}
      title={isStarred ? 'Remove from sidebar' : 'Star to pin to your sidebar'}
      onClick={handleClick}
      data-testid={`star-${kind}-${id}`}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-full text-icon3',
        'transition-colors hover:bg-surface4 hover:text-icon5',
        isStarred && 'text-accent6',
        className,
      )}
    >
      <StarIcon className="h-4 w-4" fill={isStarred ? 'currentColor' : 'none'} />
    </button>
  );
}
