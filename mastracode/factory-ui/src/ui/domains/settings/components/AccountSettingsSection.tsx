import { Button } from '@mastra/playground-ui/components/Button';
import { CopyInput } from '@mastra/playground-ui/components/CopyInput';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { useApiConfig } from '../../../../api/config';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { clearMastraCodeStorage, redirectToLogout } from '../../auth/services/auth';
import { SettingsContainer, SettingsItem, SettingsRow } from '@mastra/playground-ui/new/settings';

import { PreferencesSettings } from './SettingsPanel.parts';
import { SettingsSubsection } from './SettingsSubsection';
import { PendingField } from '../../../ui/PendingField';
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

const PROFILE_DESCRIPTION = 'Your signed-in identity for this MastraCode deployment.';

const ACCOUNT_VALUE_SKELETON = (
  <span aria-hidden>
    <SkeletonText line="text-caption" className="w-24 motion-reduce:before:animate-none" />
  </span>
);

function ProfileSubsection({ auth }: { auth: ReturnType<typeof useFactoryAuth> }) {
  if (auth.isPending) {
    return (
      <ProfileItems
        name={ACCOUNT_VALUE_SKELETON}
        email={ACCOUNT_VALUE_SKELETON}
        authentication={ACCOUNT_VALUE_SKELETON}
        accountId=""
        organizationId=""
      />
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
    <ProfileItems
      name={<AccountValue>{user?.name ?? 'Not provided'}</AccountValue>}
      email={<AccountValue>{user?.email ?? 'Not provided'}</AccountValue>}
      authentication={<AccountValue>{authProviderLabel(state.provider)}</AccountValue>}
      accountId={user?.userId}
      organizationId={user?.organizationId}
    />
  );
}

function ProfileItems({
  name,
  email,
  authentication,
  accountId,
  organizationId,
}: {
  name: ReactNode;
  email: ReactNode;
  authentication: ReactNode;
  accountId: string | undefined;
  organizationId: string | undefined;
}) {
  return (
    <SettingsSubsection scope="personal" title="Profile" description={PROFILE_DESCRIPTION}>
      <SettingsContainer>
        <SettingsItem title="Name" description="From your sign-in provider.">
          {name}
        </SettingsItem>
        <SettingsItem title="Email" description="From your sign-in provider.">
          {email}
        </SettingsItem>
        <SettingsItem title="Authentication" description="How you signed in.">
          {authentication}
        </SettingsItem>
        {accountId !== undefined && (
          <SettingsItem title="Account ID" description="Useful when contacting support.">
            <PendingField pending={!accountId} className="w-full sm:w-55">
              <CopyInput value={accountId} label="account ID" />
            </PendingField>
          </SettingsItem>
        )}
        {organizationId !== undefined && (
          <SettingsItem title="Organization ID" description="The organization that owns this Factory.">
            <PendingField pending={!organizationId} className="w-full sm:w-55">
              <CopyInput value={organizationId} label="organization ID" />
            </PendingField>
          </SettingsItem>
        )}
      </SettingsContainer>
    </SettingsSubsection>
  );
}
