import { Button } from '@mastra/playground-ui/components/Button';
import { CopyField } from '@mastra/playground-ui/components/CopyField';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useApiConfig } from '../../../../api/config';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { clearMastraCodeStorage, redirectToLogout } from '../../auth/services/auth';
import { SettingsContainer, SettingsItem, SettingsRow, SettingsSkeleton } from '@mastra/playground-ui/new/settings';

import { PreferencesSettings } from './SettingsPanel.parts';
import { SettingsSubsection } from './SettingsSubsection';
import { IconArrowBoxLeft } from '@mastra/playground-ui/icons/central/IconArrowBoxLeft';

const AUTH_PROVIDER_LABELS: Record<string, string> = {
  workos: 'WorkOS',
  'better-auth': 'Email and password',
  'mastra-studio': 'Mastra Studio',
};

function authProviderLabel(provider: string | undefined): string {
  if (!provider) return 'Unknown';
  return (
    AUTH_PROVIDER_LABELS[provider] ??
    provider
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function AccountValue({ children }: { children: string }) {
  return (
    <Txt tone="muted" as="span" variant="caption" className="truncate">
      {children}
    </Txt>
  );
}

export function AccountSettingsSection() {
  const auth = useFactoryAuth();
  const { baseUrl } = useApiConfig();
  const signedIn = !!auth.data?.authEnabled && auth.data.authenticated;

  const logOut = () => {
    clearMastraCodeStorage();
    redirectToLogout(baseUrl);
  };

  // Preferences are stored in this browser, so they don't wait on, or disappear with, the account details.
  return (
    <>
      <ProfileSubsection auth={auth} />
      <PreferencesSettings />
      {signedIn && (
        <SettingsSubsection scope="personal" title="Session">
          <SettingsContainer>
            <SettingsRow label="Log out" description="End your session on this device.">
              <Button type="button" size="sm" aria-label="Log out of MastraCode" onClick={logOut}>
                <IconArrowBoxLeft aria-hidden="true" />
                Log out
              </Button>
            </SettingsRow>
          </SettingsContainer>
        </SettingsSubsection>
      )}
    </>
  );
}

function ProfileSubsection({ auth }: { auth: ReturnType<typeof useFactoryAuth> }) {
  if (auth.isPending) {
    return (
      <SettingsSubsection scope="personal" title="Profile">
        <SettingsContainer>
          <SettingsSkeleton label="Loading your account" rows={3} />
        </SettingsContainer>
      </SettingsSubsection>
    );
  }

  if (auth.isError) {
    return <Notice variant="destructive">Could not load your account details. Reload the page to try again.</Notice>;
  }

  const state = auth.data;
  if (!state?.authEnabled) {
    return <Notice variant="info">Authentication is not enabled for this deployment.</Notice>;
  }

  if (!state.authenticated) {
    return <Notice variant="info">Sign in to view your account details.</Notice>;
  }

  const user = state.user;

  return (
    <SettingsSubsection
      scope="personal"
      title="Profile"
      description="Your signed-in identity for this MastraCode deployment."
    >
      <SettingsContainer>
        <SettingsItem title="Name" description="From your sign-in provider.">
          <AccountValue>{user?.name ?? 'Not provided'}</AccountValue>
        </SettingsItem>
        <SettingsItem title="Email" description="From your sign-in provider.">
          <AccountValue>{user?.email ?? 'Not provided'}</AccountValue>
        </SettingsItem>
        <SettingsItem title="Authentication" description="How you signed in.">
          <AccountValue>{authProviderLabel(state.provider)}</AccountValue>
        </SettingsItem>
        {user?.userId && (
          <SettingsItem title="Account ID" description="Useful when contacting support.">
            <CopyField value={user.userId} label="account ID" className="w-full sm:w-55" />
          </SettingsItem>
        )}
        {user?.organizationId && (
          <SettingsItem title="Organization ID" description="The organization that owns this Factory.">
            <CopyField value={user.organizationId} label="organization ID" className="w-full sm:w-55" />
          </SettingsItem>
        )}
      </SettingsContainer>
    </SettingsSubsection>
  );
}
