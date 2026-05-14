import { Button, cn } from '@mastra/playground-ui';
import { Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useToggleStoredAgentStar } from '../hooks/use-stored-agent-star';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';

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
  const { data: capabilities } = useAuthCapabilities();

  if (!features.stars) return null;

  const signedIn = capabilities ? isAuthenticated(capabilities) : false;
  const label = isStarred ? 'Unstar agent' : 'Star agent';
  const disabledLabel = 'Sign in to star this agent';
  const starText = starCount === 1 ? 'Star' : 'Stars';
  const isDisabled = toggle.isPending || !signedIn;

  return (
    <Button
      type="button"
      variant="default"
      size={size}
      aria-pressed={isStarred}
      aria-label={signedIn ? label : disabledLabel}
      title={signedIn ? label : disabledLabel}
      disabled={isDisabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!signedIn) return;
        toggle.mutate({ starred: !isStarred });
      }}
      className={cn('shrink-0', signedIn ? 'cursor-pointer' : 'cursor-not-allowed', className)}
    >
      <Star
        size={iconSizes[size]}
        className={cn('shrink-0', isStarred && 'fill-current text-yellow-300')}
        aria-hidden
      />
      {showCount && typeof starCount === 'number' && (
        <span className="leading-none whitespace-nowrap">
          <span className="tabular-nums">{starCount}</span> {starText}
        </span>
      )}
    </Button>
  );
};
