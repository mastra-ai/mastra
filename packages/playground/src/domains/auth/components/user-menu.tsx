import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Loader2, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

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
        <button type="button" className="hover:bg-surface2 flex items-center gap-2 rounded-md p-1 transition-colors">
          <UserAvatar user={user} size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-border1 border-b p-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="md" />
            <div className="flex flex-col overflow-hidden">
              <Txt variant="ui-md" className="truncate font-medium">
                {displayName}
              </Txt>
              {user.email && (
                <Txt variant="ui-sm" className="text-neutral3 truncate">
                  {user.email}
                </Txt>
              )}
            </div>
          </div>
        </div>

        {/* Preview as role section — only for admins with available roles */}
        {availableRoles && availableRoles.length > 0 && (
          <div className="border-border1 border-b p-2">
            <Txt variant="ui-xs" className="text-neutral3 px-2 py-1 tracking-wider uppercase">
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
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    isActive ? 'bg-surface2' : 'hover:bg-surface2'
                  } ${isSwitching ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {isSwitching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span className="flex-1 capitalize">{role.name}</span>
                  {isActive && <X className="text-neutral3 hover:text-neutral1 h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-1 p-2">
          <Button
            as={Link}
            to="/settings"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button variant="ghost" onClick={handleLogout} disabled={isPending} className="w-full justify-start">
            {isPending ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
