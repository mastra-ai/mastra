import { Button, cn } from '@mastra/playground-ui';
import { Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useToggleStoredAgentStar } from '../hooks/use-stored-agent-star';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';

export interface StarButtonProps {
  agentId: string;
  isStarred?: boolean;
  starCount?: number;
  size?: 'sm' | 'md';
  className?: string;
  /** Show the count badge next to the icon. Defaults to true. */
  showCount?: boolean;
}

const iconSizes = {
  sm: 14,
  md: 16,
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

  const label = isStarred ? 'Unstar agent' : 'Star agent';
  const starText = starCount === 1 ? 'Star' : 'Stars';

  return (
    <Button
      type="button"
      variant="default"
      size={size}
      aria-pressed={isStarred}
      aria-label={label}
      title={label}
      disabled={toggle.isPending}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        toggle.mutate({ starred: !isStarred });
      }}
      className={cn('shrink-0 cursor-pointer', className)}
    >
      <Star
        size={iconSizes[size]}
        className={cn('shrink-0', isStarred && 'fill-current text-yellow-300')}
        aria-hidden
      />
      {showCount && typeof starCount === 'number' && (
        <span className="leading-none">
          <span className="tabular-nums">{starCount}</span> {starText}
        </span>
      )}
    </Button>
  );
};
