import { Avatar } from '@mastra/playground-ui';
import type { AuthenticatedUser, CurrentUser } from '../types';

export type UserAvatarProps = {
  user: AuthenticatedUser | CurrentUser;
  size?: 'sm' | 'md' | 'lg';
};

/**
 * User avatar component.
 *
 * Displays the user's avatar image or a fallback with their initial.
 *
 * @example
 * ```tsx
 * import { UserAvatar } from '@/domains/auth/components/user-avatar';
 *
 * function Header({ user }) {
 *   return <UserAvatar user={user} size="md" />;
 * }
 * ```
 */
export function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  if (!user) return null;

  const displayName = user.name || user.email || 'User';

  return <Avatar src={user.avatarUrl} name={displayName} size={size} />;
}
