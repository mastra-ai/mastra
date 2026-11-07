import { Button } from '@mastra/playground-ui/components/Button';
import { CopyInput } from '@mastra/playground-ui/components/CopyInput';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LogOut } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { clearMastraCodeStorage, redirectToLogout } from '../../auth/services/auth';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { SettingsSubsection } from './SettingsSubsection';

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

function AccountSettingsSkeleton() {
  return (
    <SettingsContainer>
      <SettingsRow label="Name">
        <Skeleton className="h-4 w-28" />
      </SettingsRow>
      <SettingsRow label="Email">
        <Skeleton className="h-4 w-40" />
      </SettingsRow>
      <SettingsRow label="Authentication">
        <Skeleton className="h-4 w-24" />
      </SettingsRow>
    </SettingsContainer>
  );
}

export function AccountSettingsSection() {
  const auth = useFactoryAuth();
  const { baseUrl } = useApiConfig();

  if (auth.isPending) {
    return (
      <SettingsSubsection scope="personal" title="Profile">
        <AccountSettingsSkeleton />
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

  const logOut = () => {
    clearMastraCodeStorage();
    redirectToLogout(baseUrl);
  };

  return (
    <>
      <SettingsSubsection
        scope="personal"
        title="Profile"
        description="Your signed-in identity for this MastraCode deployment."
      >
        <SettingsContainer>
          <SettingsRow label="Name" description="From your sign-in provider.">
            <AccountValue>{user?.name ?? 'Not provided'}</AccountValue>
          </SettingsRow>
          <SettingsRow label="Email" description="From your sign-in provider.">
            <AccountValue>{user?.email ?? 'Not provided'}</AccountValue>
          </SettingsRow>
          <SettingsRow label="Authentication" description="How you signed in.">
            <AccountValue>{authProviderLabel(state.provider)}</AccountValue>
          </SettingsRow>
          {user?.userId && (
            <SettingsRow label="Account ID" description="Useful when contacting support.">
              <CopyInput value={user.userId} label="account ID" />
            </SettingsRow>
          )}
          {user?.organizationId && (
            <SettingsRow label="Organization ID" description="The organization that owns this Factory.">
              <CopyInput value={user.organizationId} label="organization ID" />
            </SettingsRow>
          )}
        </SettingsContainer>
      </SettingsSubsection>
      <SettingsSubsection scope="personal" title="Session">
        <SettingsContainer>
          <SettingsRow label="Log out" description="End your session on this device.">
            <Button type="button" size="sm" aria-label="Log out of MastraCode" onClick={logOut}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </SettingsRow>
        </SettingsContainer>
      </SettingsSubsection>
    </>
  );
}
