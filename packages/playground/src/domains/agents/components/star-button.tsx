import { Star } from 'lucide-react';
import { useToggleStoredAgentStar } from '../hooks/use-stored-agent-star';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { cn } from '@/lib/utils';

export interface StarButtonProps {
  agentId: string;
  isStarred?: boolean;
  starCount?: number;
  size?: 'sm' | 'md';
  className?: string;
  /** Show the count badge next to the icon. Defaults to true. */
  showCount?: boolean;
}

const sizes = {
  sm: { icon: 14, text: 'text-xs', padding: 'px-1.5 py-0.5 gap-1' },
  md: { icon: 16, text: 'text-sm', padding: 'px-2 py-1 gap-1.5' },
} as const;

/**
 * Toggles the star state for a stored agent. Renders nothing if the EE
 * `agent.stars` flag is off. Stops click propagation so it can sit inside a
 * row that is itself a link.
 */
export const StarButton = ({
  agentId,
  isStarred = false,
  starCount,
  size = 'md',
  className,
  showCount = true,
}: StarButtonProps) => {
  const features = useBuilderAgentFeatures();
  const toggle = useToggleStoredAgentStar(agentId);

  if (!features.stars) return null;

  const config = sizes[size];
  const label = isStarred ? 'Unstar agent' : 'Star agent';

  return (
    <button
      type="button"
      aria-pressed={isStarred}
      aria-label={label}
      title={label}
      disabled={toggle.isPending}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        toggle.mutate({ starred: !isStarred });
      }}
      className={cn(
        'inline-flex items-center rounded-md border border-transparent text-neutral3 transition-colors',
        'hover:bg-surface3 hover:text-neutral6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent1',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isStarred && 'text-accent3',
        config.padding,
        config.text,
        className,
      )}
    >
      <Star
        size={config.icon}
        className={cn('shrink-0', isStarred && 'fill-current')}
        aria-hidden
      />
      {showCount && typeof starCount === 'number' && (
        <span className="tabular-nums leading-none">{starCount}</span>
      )}
    </button>
  );
};
