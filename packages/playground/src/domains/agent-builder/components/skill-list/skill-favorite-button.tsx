import { Button, cn } from '@mastra/playground-ui';
import { Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { useToggleStoredSkillFavorite } from '@/domains/agent-builder/hooks/use-stored-skill-favorite';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';

export interface SkillFavoriteButtonProps {
  skillId: string;
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
 * Toggles the favorite state for a stored skill. Mirrors the agent-list
 * `FavoriteButton` shell so the skill list matches the agent list visually.
 * Renders nothing if the EE `agent.favorites` flag is off. Stops click
 * propagation so it can sit inside a row that is itself a link.
 */
export const SkillFavoriteButton = ({
  skillId,
  isFavorited = false,
  favoriteCount,
  size = 'md',
  className,
  showCount = true,
}: SkillFavoriteButtonProps) => {
  const features = useBuilderAgentFeatures();
  const toggle = useToggleStoredSkillFavorite(skillId);
  const { data: capabilities } = useAuthCapabilities();

  if (!features.favorites) return null;

  const signedIn = capabilities ? isAuthenticated(capabilities) : false;
  const label = isFavorited ? 'Unstar skill' : 'Star skill';
  const disabledLabel = 'Sign in to star this skill';
  const hasCount = typeof favoriteCount === 'number' && favoriteCount > 0;
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
      {showCount && (
        <span className="leading-none whitespace-nowrap">
          {hasCount ? (
            <>
              <span className="tabular-nums">{favoriteCount}</span> {countLabel}
            </>
          ) : (
            'Star'
          )}
        </span>
      )}
    </Button>
  );
};
