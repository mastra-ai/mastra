import { Avatar } from '@/ds/components/Avatar/Avatar';
import type { AuthenticatedUser } from '../types';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

export interface UserAvatarProps {
  user: AuthenticatedUser;
  size?: UserAvatarSize;
}

/**
 * User avatar component displaying user's avatar image or initials fallback.
 *
 * Uses the Avatar component from the design system and extracts user info
 * from the authenticated user object.
 *
 * @example
 * ```tsx
 * import { UserAvatar } from '@mastra/playground-ui';
 * import { useCurrentUser } from '@mastra/playground-ui';
 *
 * function UserProfile() {
 *   const user = useCurrentUser();
 *
 *   if (!user) return null;
 *
 *   return <UserAvatar user={user} size="lg" />;
 * }
 * ```
 */
export function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  // Use name for avatar, fallback to email or 'U' if neither available
  const displayName = user.name || user.email || 'User';

  return <Avatar src={user.avatarUrl} name={displayName} size={size} />;
}
