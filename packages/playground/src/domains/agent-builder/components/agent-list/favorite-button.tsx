import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { useToggleStoredAgentFavorite } from '@/domains/agent-builder/hooks/use-stored-agent-favorite';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';

export interface FavoriteButtonProps {
  agentId: string;
  isFavorited?: boolean;
  favoriteCount?: number;
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
 * Toggles the favorite state for a stored agent. Renders nothing if the EE
 * `agent.favorites` flag is off. Stops click propagation so it can sit inside a
 * row that is itself a link.
 */
export const FavoriteButton = ({
  agentId,
  isFavorited = false,
  favoriteCount,
  size = 'md',
  className,
  showCount = true,
}: FavoriteButtonProps) => {
  const features = useBuilderAgentFeatures();
  const toggle = useToggleStoredAgentFavorite(agentId);
  const { data: capabilities, isLoading } = useAuthCapabilities();

  if (isLoading) return null;
  if (!features.favorites) return null;

  const signedIn = capabilities ? isAuthenticated(capabilities) : false;
  const label = isFavorited ? 'Unstar agent' : 'Star agent';
  const disabledLabel = 'Sign in to star this agent';
  const countLabel = favoriteCount === 1 ? 'Star' : 'Stars';
  const isDisabled = toggle.isPending || !signedIn;

  return (
    <Button
      type="button"
      variant="default"
      size={size}
      aria-pressed={isFavorited}
      aria-label={signedIn ? label : disabledLabel}
      title={signedIn ? label : disabledLabel}
      disabled={isDisabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!signedIn) return;
        toggle.mutate({ favorited: !isFavorited });
      }}
      className={cn('shrink-0', signedIn ? 'cursor-pointer' : 'cursor-not-allowed', className)}
    >
      <Star
        size={iconSizes[size]}
        className={cn('shrink-0', isFavorited && 'fill-current text-yellow-300')}
        aria-hidden
      />
      {showCount && typeof favoriteCount === 'number' && (
        <span className="leading-none whitespace-nowrap">
          <span className="tabular-nums">{favoriteCount}</span> {countLabel}
        </span>
      )}
    </Button>
  );
};
