import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Bot, Brain, Cable, ChevronsUpDown, CircleUserRound, LogOut, Palette, Settings } from 'lucide-react';
import { Link, useLocation, useMatch, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { settingsSectionPath } from '../../settings/settingsSections';
import { clearMastraCodeStorage, logoutUrl } from '../services/auth';

export function SidebarUserMenu() {
  const auth = useFactoryAuth();
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const location = useLocation();
  const settingsOpen = !!useMatch('/factories/:factoryId/settings/*');
  const { state: sidebarState, setOpenMobile } = useSidebar();

  if (!factoryId) return null;

  if (auth.isLoading) {
    return (
      <li role="status" aria-label="Checking sign-in" className="flex h-9 items-center gap-2 px-3">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </li>
    );
  }

  const account = auth.data;
  const signedIn = account?.authEnabled && account.authenticated;
  const identity = signedIn ? (account.user?.name ?? account.user?.email ?? 'User') : 'Settings';
  const menuLabel = signedIn ? 'User menu' : 'Settings menu';
  // Switching sections from the menu must retain the original Back to app destination.
  const settingsState = settingsOpen ? location.state : { from: location };
  const closeMobileNavigation = () => setOpenMobile(false);

  return (
    <DropdownMenu>
      <Sidebar.NavLink asChild link={{ name: menuLabel, url: '#', icon: <CircleUserRound /> }} isActive={settingsOpen}>
        <DropdownMenu.Trigger id="settings-trigger" render={<button type="button" />} aria-label={menuLabel}>
          {signedIn ? <CircleUserRound aria-hidden="true" /> : <Settings aria-hidden="true" />}
          <Sidebar.NavLabel>{identity}</Sidebar.NavLabel>
          {sidebarState !== 'collapsed' && <ChevronsUpDown aria-hidden="true" />}
        </DropdownMenu.Trigger>
      </Sidebar.NavLink>
      <DropdownMenu.Content side="top" align="start" className="w-64" aria-label={menuLabel}>
        <DropdownMenu.Label>Your settings</DropdownMenu.Label>
        {signedIn && (
          <DropdownMenu.Item
            render={<Link to={settingsSectionPath(factoryId, 'account')} state={settingsState} />}
            onSelect={closeMobileNavigation}
          >
            <CircleUserRound aria-hidden="true" />
            My account
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          render={<Link to={settingsSectionPath(factoryId, 'preferences')} state={settingsState} />}
          onSelect={closeMobileNavigation}
        >
          <Palette aria-hidden="true" />
          Preferences
        </DropdownMenu.Item>
        <DropdownMenu.Item
          render={<Link to={settingsSectionPath(factoryId, 'personal-models')} state={settingsState} />}
          onSelect={closeMobileNavigation}
        >
          <Bot aria-hidden="true" />
          Your models
        </DropdownMenu.Item>
        <DropdownMenu.Item
          render={<Link to={settingsSectionPath(factoryId, 'memory')} state={settingsState} />}
          onSelect={closeMobileNavigation}
        >
          <Brain aria-hidden="true" />
          Your memory
        </DropdownMenu.Item>
        <DropdownMenu.Item
          render={<Link to={settingsSectionPath(factoryId, 'connections')} state={settingsState} />}
          onSelect={closeMobileNavigation}
        >
          <Cable aria-hidden="true" />
          Connections
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          render={<Link to={settingsSectionPath(factoryId, 'models')} state={settingsState} />}
          onSelect={closeMobileNavigation}
        >
          <Settings aria-hidden="true" />
          Settings
        </DropdownMenu.Item>
        {signedIn && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item render={<a href={logoutUrl(baseUrl)} />} onSelect={clearMastraCodeStorage}>
              <LogOut aria-hidden="true" />
              Log out
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
