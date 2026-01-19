import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { useLogout } from '../hooks/use-auth-actions';
import { useAuthCapabilities } from '../hooks/use-auth-capabilities';
import { UserAvatar } from './user-avatar';
import { isAuthenticated } from '../types';

export interface UserMenuProps {
  /** Custom profile URL (overrides default from auth provider) */
  profileUrl?: string;
  /** Callback when user clicks profile link */
  onProfileClick?: () => void;
  /** Callback after successful logout */
  onLogoutSuccess?: () => void;
  /** Show role/permissions in menu */
  showRolesAndPermissions?: boolean;
}

/**
 * User menu component with dropdown showing user info and actions.
 *
 * Displays user name, email, optional role/permissions, profile link, and sign out button.
 * Uses Popover for dropdown menu.
 *
 * @example
 * ```tsx
 * import { UserMenu } from '@mastra/playground-ui';
 *
 * function Header() {
 *   return (
 *     <header>
 *       <UserMenu
 *         profileUrl="/profile"
 *         showRolesAndPermissions
 *         onLogoutSuccess={() => window.location.href = '/'}
 *       />
 *     </header>
 *   );
 * }
 * ```
 */
export function UserMenu({
  profileUrl,
  onProfileClick,
  onLogoutSuccess,
  showRolesAndPermissions = false,
}: UserMenuProps) {
  const { data: capabilities } = useAuthCapabilities();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const [isOpen, setIsOpen] = useState(false);

  // Only render if authenticated
  if (!capabilities || !isAuthenticated(capabilities)) {
    return null;
  }

  const { user, access } = capabilities;

  // Determine profile URL from props or auth provider
  const effectiveProfileUrl = profileUrl; // Auth provider getUserProfileUrl not exposed in capabilities yet

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: data => {
        setIsOpen(false);
        if (data.redirectTo) {
          window.location.href = data.redirectTo;
        } else if (onLogoutSuccess) {
          onLogoutSuccess();
        } else {
          window.location.reload();
        }
      },
    });
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    if (onProfileClick) {
      onProfileClick();
    } else if (effectiveProfileUrl) {
      window.location.href = effectiveProfileUrl;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md p-1 hover:bg-surface2 transition-colors"
          aria-label="User menu"
        >
          <UserAvatar user={user} size="md" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-4">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="flex-1 min-w-0">
              {user.name && (
                <Txt variant="ui-md" className="font-medium truncate">
                  {user.name}
                </Txt>
              )}
              {user.email && (
                <Txt variant="ui-sm" className="text-neutral2 truncate">
                  {user.email}
                </Txt>
              )}
            </div>
          </div>

          {/* Roles and Permissions */}
          {showRolesAndPermissions && access && (access.roles.length > 0 || access.permissions.length > 0) && (
            <div className="border-t border-border1 pt-3">
              {access.roles.length > 0 && (
                <div className="mb-2">
                  <Txt variant="ui-xs" className="text-neutral2 uppercase mb-1">
                    Roles
                  </Txt>
                  <div className="flex flex-wrap gap-1">
                    {access.roles.map(role => (
                      <span key={role} className="px-2 py-0.5 bg-surface2 text-neutral4 rounded text-xs">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {access.permissions.length > 0 && (
                <div>
                  <Txt variant="ui-xs" className="text-neutral2 uppercase mb-1">
                    Permissions
                  </Txt>
                  <div className="flex flex-wrap gap-1">
                    {access.permissions.slice(0, 5).map(permission => (
                      <span key={permission} className="px-2 py-0.5 bg-surface2 text-neutral4 rounded text-xs">
                        {permission}
                      </span>
                    ))}
                    {access.permissions.length > 5 && (
                      <span className="px-2 py-0.5 bg-surface2 text-neutral2 rounded text-xs">
                        +{access.permissions.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-border1 pt-3 flex flex-col gap-2">
            {effectiveProfileUrl && (
              <Button variant="ghost" className="justify-start w-full" onClick={handleProfileClick}>
                Profile
              </Button>
            )}
            <Button
              variant="ghost"
              className="justify-start w-full text-error"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
