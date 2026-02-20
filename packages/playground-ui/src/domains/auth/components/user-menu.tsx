import { Button } from '@/ds/components/Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover/popover';
import { Txt } from '@/ds/components/Txt';

import { useLogout } from '../hooks';
import type { AuthenticatedUser, CurrentUser } from '../types';
import { UserAvatar } from './user-avatar';

export type UserMenuProps = {
  user: AuthenticatedUser | CurrentUser;
};

/**
 * User menu component.
 *
 * Displays user avatar with a dropdown menu containing
 * user info and logout button.
 *
 * @example
 * ```tsx
 * import { UserMenu, useCurrentUser } from '@mastra/playground-ui';
 *
 * function Header() {
 *   const { data: user } = useCurrentUser();
 *
 *   if (!user) return null;
 *
 *   return <UserMenu user={user} />;
 * }
 * ```
 */
export function UserMenu({ user }: UserMenuProps) {
  const { mutate: logout, isPending } = useLogout();

  if (!user) return null;

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: data => {
        if (data.redirectTo) {
          window.location.href = data.redirectTo;
        } else {
          window.location.reload();
        }
      },
    });
  };

  const displayName = user.name || user.email || 'User';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-md p-1 hover:bg-surface2 transition-colors">
          <UserAvatar user={user} size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="border-b border-border1 p-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="md" />
            <div className="flex flex-col overflow-hidden">
              <Txt variant="ui-md" className="truncate font-medium">
                {displayName}
              </Txt>
              {user.email && (
                <Txt variant="ui-sm" className="truncate text-neutral3">
                  {user.email}
                </Txt>
              )}
            </div>
          </div>
        </div>
        <div className="p-2">
          <Button variant="ghost" onClick={handleLogout} disabled={isPending} className="w-full justify-start">
            {isPending ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
