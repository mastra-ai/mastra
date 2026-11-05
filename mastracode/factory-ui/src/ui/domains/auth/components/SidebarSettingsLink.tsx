import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Settings2 } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { FactoryAuthState } from '../services/auth';
import { useSettingsOpen } from '../../settings/hooks/useSettingsOpen';
import { settingsSectionPath } from '../../settings/settingsSections';

export function SidebarSettingsLink() {
  const auth = useFactoryAuth();
  const { factoryId } = useParams<{ factoryId: string }>();
  const location = useLocation();
  const settingsOpen = useSettingsOpen();
  const { state: sidebarState, setOpenMobile } = useSidebar();

  if (!factoryId) return null;

  if (auth.isLoading) {
    return (
      <Sidebar.NavLink
        role="status"
        aria-label="Checking sign-in"
        render={
          <div aria-hidden className="pointer-events-none">
            <Skeleton className="size-icon-md shrink-0 rounded-full motion-reduce:before:animate-none" />
            <Sidebar.NavLabel>
              <Skeleton className="h-3 w-24 max-w-full motion-reduce:before:animate-none" />
            </Sidebar.NavLabel>
          </div>
        }
      />
    );
  }

  const account = auth.data;
  const userName = signedInName(account);
  const url = settingsSectionPath(factoryId, 'preferences');
  const backToAppState = settingsOpen ? location.state : { from: location };

  return (
    <Sidebar.NavLink
      link={{ name: 'Settings', url }}
      isActive={settingsOpen}
      render={
        <Link
          id="sidebar-settings-link"
          to={url}
          state={backToAppState}
          aria-label={userName ? `Settings for ${userName}` : 'Settings'}
          onClick={() => setOpenMobile(false)}
        >
          {userName ? (
            <Avatar src={account?.user?.avatarUrl} name={userName} size="inline" />
          ) : (
            <Settings2 aria-hidden="true" />
          )}
          <Sidebar.NavLabel>
            <Txt as="span" variant="label" tone="ink">
              {userName ?? 'Settings'}
            </Txt>
          </Sidebar.NavLabel>
          {userName && sidebarState !== 'collapsed' && <Settings2 aria-hidden="true" />}
        </Link>
      }
    />
  );
}

function signedInName(account: FactoryAuthState | undefined): string | undefined {
  if (!account?.authEnabled || !account.authenticated) return undefined;
  const name = account.user?.name?.trim();
  if (name) return name;
  return account.user?.email || 'User';
}
