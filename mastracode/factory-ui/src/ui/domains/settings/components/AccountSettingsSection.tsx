import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LogOut } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { clearMastraCodeStorage, redirectToLogout } from '../../auth/services/auth';
import { SettingsCard, SettingsRow } from './SettingsCard';
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

function AccountValue({ children, mono = false }: { children: string; mono?: boolean }) {
  return (
    <Txt as="span" variant="ui-sm" font={mono ? 'mono' : undefined} className="text-icon4 truncate">
      {children}
    </Txt>
  );
}

function CopyableAccountValue({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <AccountValue mono>{value}</AccountValue>
      <CopyButton content={value} size="icon-xs" variant="ghost" tooltip={`Copy ${label}`} />
    </div>
  );
}

function AccountSettingsSkeleton() {
  return (
    <SettingsCard>
      <SettingsRow label="Name">
        <Skeleton className="h-4 w-28" />
      </SettingsRow>
      <SettingsRow label="Email">
        <Skeleton className="h-4 w-40" />
      </SettingsRow>
      <SettingsRow label="Authentication">
        <Skeleton className="h-4 w-24" />
      </SettingsRow>
    </SettingsCard>
  );
}

export function AccountSettingsSection() {
  const auth = useFactoryAuth();
  const { baseUrl } = useApiConfig();

  if (auth.isPending) {
    return (
      <SettingsSubsection title="Profile">
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
    <div className="flex flex-col gap-8">
      <SettingsSubsection title="Profile" description="Your signed-in identity for this MastraCode deployment.">
        <SettingsCard>
          <SettingsRow label="Name">
            <AccountValue>{user?.name ?? 'Not provided'}</AccountValue>
          </SettingsRow>
          <SettingsRow label="Email">
            <AccountValue>{user?.email ?? 'Not provided'}</AccountValue>
          </SettingsRow>
          <SettingsRow label="Authentication">
            <AccountValue>{authProviderLabel(state.provider)}</AccountValue>
          </SettingsRow>
          {user?.userId && (
            <SettingsRow label="Account ID" hint="Useful when contacting support.">
              <CopyableAccountValue value={user.userId} label="account ID" />
            </SettingsRow>
          )}
          {user?.organizationId && (
            <SettingsRow label="Organization ID" hint="The organization that owns this Factory.">
              <CopyableAccountValue value={user.organizationId} label="organization ID" />
            </SettingsRow>
          )}
        </SettingsCard>
      </SettingsSubsection>
      <SettingsSubsection title="Session">
        <SettingsCard>
          <SettingsRow label="Log out" hint="End your MastraCode session on this device.">
            <Button type="button" variant="outline" size="sm" aria-label="Log out of MastraCode" onClick={logOut}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSubsection>
    </div>
  );
}
