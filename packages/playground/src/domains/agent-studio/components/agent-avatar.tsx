import { AgentIcon } from '@mastra/playground-ui';

import { cn } from '@/lib/utils';

export interface AgentAvatarProps {
  name?: string;
  avatarUrl?: string;
  /** Pixel size; defaults to 32. */
  size?: number;
  className?: string;
}

/**
 * Rounded agent avatar. Falls back to the existing AgentIcon when no image is set.
 */
export function AgentAvatar({ name, avatarUrl, size = 32, className }: AgentAvatarProps) {
  const style = { width: size, height: size } as const;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `${name} avatar` : 'Agent avatar'}
        style={style}
        className={cn('rounded-full object-cover border border-border1 shrink-0', className)}
      />
    );
  }

  return (
    <span
      style={style}
      className={cn(
        'rounded-full bg-surface4 text-icon4 inline-flex items-center justify-center shrink-0 border border-border1',
        className,
      )}
      aria-hidden="true"
    >
      <AgentIcon />
    </span>
  );
}
