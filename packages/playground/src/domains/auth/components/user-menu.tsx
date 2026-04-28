import { Button, Popover, PopoverContent, PopoverTrigger, Txt } from '@mastra/playground-ui';
import { Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { useAuthCapabilities, useLogout } from '../hooks';
import { useRoleImpersonation } from '../hooks/use-role-impersonation';
import { isAuthenticated } from '../types';
import type { AuthenticatedUser, CurrentUser } from '../types';
import { UserAvatar } from './user-avatar';

export type UserMenuProps = {
  user: AuthenticatedUser | CurrentUser;
};

/**
 * User menu component.
 *
 * Displays user avatar with a dropdown menu containing
 * user info, role preview options for admins, and logout button.
 */
export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const { mutate: logout, isPending } = useLogout();
  const { data: capabilities } = useAuthCapabilities();
  const { isImpersonating, impersonatedRole, startImpersonation, stopImpersonation, isSwitching } =
    useRoleImpersonation();

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

  const availableRoles = capabilities && isAuthenticated(capabilities) ? capabilities.availableRoles : undefined;

  const displayName = user.name || user.email || 'User';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-md p-1 hover:bg-surface2 transition-colors">
          <UserAvatar user={user} size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
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

        {/* Preview as role section — only for admins with available roles */}
        {availableRoles && availableRoles.length > 0 && (
          <div className="border-b border-border1 p-2">
            <Txt variant="ui-xs" className="px-2 py-1 text-neutral3 uppercase tracking-wider">
              Preview as role
            </Txt>
            {availableRoles.map(role => {
              const isActive = isImpersonating && impersonatedRole?.id === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={isSwitching}
                  onClick={() => {
                    if (isActive) {
                      stopImpersonation();
                    } else {
                      void startImpersonation(role);
                    }
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    isActive ? 'bg-surface2' : 'hover:bg-surface2'
                  } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSwitching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span className="flex-1 capitalize">{role.name}</span>
                  {isActive && <X className="h-3.5 w-3.5 text-neutral3 hover:text-neutral1" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="p-2">
          <Button variant="ghost" onClick={handleLogout} disabled={isPending} className="w-full justify-start">
            {isPending ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
