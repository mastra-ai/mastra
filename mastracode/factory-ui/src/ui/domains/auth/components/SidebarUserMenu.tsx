import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { THEME_OPTIONS } from '@mastra/playground-ui/components/ThemeToggle';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LogOut, Settings, SunMoon } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { ACCOUNT_SETTINGS_GROUP } from '../../settings/components/SettingsNavigation';
import { useSettingsOpen } from '../../settings/hooks/useSettingsOpen';
import { settingsSectionPath } from '../../settings/settingsSections';
import { clearMastraCodeStorage, logoutUrl } from '../services/auth';

export function SidebarUserMenu() {
  const auth = useFactoryAuth();
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const location = useLocation();
  const settingsOpen = useSettingsOpen();
  const { state: sidebarState, setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();

  if (!factoryId) return null;

  if (auth.isLoading) {
    return (
      <Sidebar.NavLink
        role="status"
        aria-label="Checking sign-in"
        render={
          <div aria-hidden className="pointer-events-none h-auto min-h-10 py-1.5">
            <Skeleton className="size-avatar-sm shrink-0 rounded-full motion-reduce:before:animate-none" />
            <Sidebar.NavLabel>
              <span className="flex min-w-0 flex-col gap-1.5">
                <Skeleton className="h-3 w-24 max-w-full motion-reduce:before:animate-none" />
                <Skeleton className="h-2.5 w-32 max-w-full motion-reduce:before:animate-none" />
              </span>
            </Sidebar.NavLabel>
          </div>
        }
      />
    );
  }

  const account = auth.data;
  const signedIn = account?.authEnabled && account.authenticated;
  const triggerLabel = signedIn ? account.user?.name?.trim() || account.user?.email || 'User' : 'Settings';
  const email = signedIn ? account.user?.email : undefined;
  const menuLabel = signedIn ? 'User menu' : 'Settings menu';
  const accountSettings = ACCOUNT_SETTINGS_GROUP.items.filter(item => signedIn || item.id !== 'account');
  const backToAppState = settingsOpen ? location.state : { from: location };

  return (
    <DropdownMenu>
      <Sidebar.NavLink asChild link={{ name: menuLabel, url: '#' }} isActive={settingsOpen}>
        <DropdownMenu.Trigger
          id="user-menu-trigger"
          render={<button type="button" />}
          aria-label={menuLabel}
          className={signedIn ? 'h-auto min-h-10 py-1.5' : undefined}
        >
          {signedIn ? (
            <Avatar src={account.user?.avatarUrl} name={triggerLabel} size="sm" />
          ) : (
            <Settings aria-hidden="true" />
          )}
          <Sidebar.NavLabel>
            <span className="flex min-w-0 flex-col">
              <Txt as="span" variant="label" tone="ink" className="truncate">
                {triggerLabel}
              </Txt>
              {email && email !== triggerLabel && (
                <Txt as="span" variant="meta" tone="muted" className="truncate">
                  {email}
                </Txt>
              )}
            </span>
          </Sidebar.NavLabel>
          {sidebarState !== 'collapsed' && <DisclosureChevron direction="up" />}
        </DropdownMenu.Trigger>
      </Sidebar.NavLink>
      <DropdownMenu.Content side="top" align="start" className="max-h-(--available-height) w-72" aria-label={menuLabel}>
        {signedIn && (
          <>
            <div className="min-w-0 px-3 py-2">
              <Txt variant="caption" tone="muted" className="truncate" title={email ?? triggerLabel}>
                {email ?? triggerLabel}
              </Txt>
            </div>
            <DropdownMenu.Separator />
          </>
        )}
        <DropdownMenu.Label>{ACCOUNT_SETTINGS_GROUP.label}</DropdownMenu.Label>
        {accountSettings.map(({ id, label, icon: Icon }) => (
          <DropdownMenu.Item
            key={id}
            render={<Link to={settingsSectionPath(factoryId, id)} state={backToAppState} />}
            onClick={() => setOpenMobile(false)}
          >
            <Icon aria-hidden="true" />
            {label}
          </DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          render={<Link to={settingsSectionPath(factoryId, 'models')} state={backToAppState} />}
          onClick={() => setOpenMobile(false)}
        >
          <Settings aria-hidden="true" />
          Settings
        </DropdownMenu.Item>
        <DropdownMenu.RadioSub
          label="Theme"
          icon={<SunMoon aria-hidden="true" />}
          options={THEME_OPTIONS}
          value={theme}
          onValueChange={setTheme}
        />
        {signedIn && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item render={<a href={logoutUrl(baseUrl)} />} onClick={clearMastraCodeStorage}>
              <LogOut aria-hidden="true" />
              Log out
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
