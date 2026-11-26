import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Status } from '@mastra/playground-ui/components/StatusIndicators';
import { SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { IconArrowBoxLeft } from '@mastra/playground-ui/icons/central/IconArrowBoxLeft';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';
import { IconKey2 } from '@mastra/playground-ui/icons/central/IconKey2';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import {
  useRemoveProviderAccount,
  useRemoveProviderKey,
  useSignOutProviderOAuth,
  useStartProviderOAuth,
} from '../../../../../../hooks/use-providers';
import {
  CREDENTIAL_STATUS,
  SIGN_IN_EXPIRED_STATUS,
  accountLabel,
  accountsAt,
  signInRequest,
} from '../../provider-credential';
import type { CredentialScope, ProviderAccount, ProviderCredential } from '../../provider-credential';
import { ConnectedRow, ProviderIcon } from './ProviderRows';

export interface ProviderConnection {
  provider: ProviderInfo;
  status: StatusPresentation;
  credential: ProviderCredential | undefined;
  signInExpired: boolean;
}

const SIGNING_OUT_STATUS: StatusPresentation = {
  label: 'Signing out…',
  tone: 'progress',
  description: 'Ending the provider sign-in',
};
const REMOVING_STATUS: StatusPresentation = {
  label: 'Removing…',
  tone: 'progress',
  description: 'Deleting the saved API key',
};
const REMOVING_ACCOUNT_STATUS: StatusPresentation = {
  label: 'Removing…',
  tone: 'progress',
  description: 'Signing this account out',
};
const STARTING_SIGN_IN_STATUS: StatusPresentation = {
  label: 'Starting sign-in…',
  tone: 'progress',
  description: 'Opening the provider sign-in',
};

function pendingStatus(pending: {
  signingOut: boolean;
  removing: boolean;
  startingSignIn: boolean;
}): StatusPresentation | undefined {
  if (pending.signingOut) return SIGNING_OUT_STATUS;
  if (pending.removing) return REMOVING_STATUS;
  if (pending.startingSignIn) return STARTING_SIGN_IN_STATUS;
  return undefined;
}

export function ConnectedProviderRow({
  connection,
  requestScope,
  disabled,
  onUpdateKey,
  onOAuthStarted,
  variant = 'list',
}: {
  /** `list`: an `li` of a `ProviderRows` list. `settings`: a `SettingsItem` in a settings card. */
  variant?: 'list' | 'settings';
  connection: ProviderConnection;
  requestScope: CredentialScope | undefined;
  disabled: boolean;
  onUpdateKey: () => void;
  onOAuthStarted?: (provider: string, session: OAuthStartResponse) => void;
}) {
  const { provider, status, credential, signInExpired } = connection;
  const displayName = providerDisplayName(provider.provider);
  const signOutMutation = useSignOutProviderOAuth();
  const removeKeyMutation = useRemoveProviderKey();
  const startOAuthMutation = useStartProviderOAuth();
  const pending = pendingStatus({
    signingOut: signOutMutation.isPending,
    removing: removeKeyMutation.isPending,
    startingSignIn: startOAuthMutation.isPending,
  });

  const signOut = () => {
    signOutMutation.mutate(
      { provider: provider.provider, scope: requestScope },
      { onError: error => toast.error(error.message || 'Failed to sign out') },
    );
  };

  const startSignIn = (target?: Parameters<typeof signInRequest>[2]) => {
    if (!onOAuthStarted) return;
    startOAuthMutation.mutate(signInRequest(provider, requestScope, target), {
      onSuccess: session => onOAuthStarted(provider.provider, session),
      onError: error => toast.error(error.message || 'Failed to start sign-in'),
    });
  };

  const removeKey = () => {
    removeKeyMutation.mutate(
      { provider: provider.provider, scope: requestScope },
      { onError: error => toast.error(error.message || 'Failed to remove API key') },
    );
  };

  const canSignIn = provider.oauth?.supported === true && onOAuthStarted !== undefined;
  const accounts = credential === 'oauth' ? accountsAt(provider, requestScope ?? 'user') : [];
  const several = accounts.length > 1;
  const rowStatus = several && !accounts.every(account => account.expired) ? CREDENTIAL_STATUS.oauth : status;
  const menu = credential ? (
    <CredentialMenu
      displayName={displayName}
      credential={credential}
      disabled={disabled || pending !== undefined}
      onSignInAgain={canSignIn && signInExpired && !several ? () => startSignIn() : undefined}
      onAddAccount={canSignIn ? () => startSignIn({ addAccount: true }) : undefined}
      signOutLabel={several ? 'Sign out of all accounts' : 'Sign out'}
      onSignOut={signOut}
      onUpdateKey={provider.connectWithMastraAccount ? undefined : onUpdateKey}
      onRemoveKey={removeKey}
    />
  ) : undefined;

  if (variant === 'settings') {
    return (
      <SettingsItem
        media={
          <SettingsItemIcon>
            {/* The span keeps each brand icon's own optical size. */}
            <span className="flex">
              <ProviderIcon provider={provider.provider} />
            </span>
          </SettingsItemIcon>
        }
        title={displayName}
        description={<Status presentation={pending ?? status} />}
      >
        {menu}
      </SettingsItem>
    );
  }

  return (
    <>
      <ConnectedRow
        icon={<ProviderIcon provider={provider.provider} />}
        title={displayName}
        status={pending ?? rowStatus}
      >
        {menu}
      </ConnectedRow>
      {several &&
        accounts.map((account, index) => (
          <AccountRow
            key={account.id}
            provider={provider.provider}
            account={account}
            label={accountLabel(account, index)}
            requestScope={requestScope}
            disabled={disabled || pending !== undefined}
            onSignInAgain={canSignIn ? () => startSignIn({ accountId: account.id }) : undefined}
          />
        ))}
    </>
  );
}

/** One of several subscriptions of a provider, under the provider's row. */
function AccountRow({
  provider,
  account,
  label,
  requestScope,
  disabled,
  onSignInAgain,
}: {
  provider: string;
  account: ProviderAccount;
  label: string;
  requestScope: CredentialScope | undefined;
  disabled: boolean;
  onSignInAgain: (() => void) | undefined;
}) {
  const removeMutation = useRemoveProviderAccount();
  const remove = () => {
    removeMutation.mutate(
      { provider, accountId: account.id, scope: requestScope },
      { onError: error => toast.error(error.message || 'Failed to remove account') },
    );
  };

  return (
    <ConnectedRow
      icon={<span aria-hidden="true" className="size-icon-md shrink-0" />}
      title={label}
      status={removeMutation.isPending ? REMOVING_ACCOUNT_STATUS : account.expired ? SIGN_IN_EXPIRED_STATUS : undefined}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${label} actions`}
              disabled={disabled || removeMutation.isPending}
            >
              <IconDotGrid1x3Horizontal />
            </Button>
          }
        />
        <DropdownMenu.Content align="end">
          {account.expired && onSignInAgain && (
            <>
              <DropdownMenu.Item onClick={onSignInAgain}>
                <IconArrowRotateClockwise /> Sign in again
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
            </>
          )}
          <DropdownMenu.Item variant="destructive" onClick={remove}>
            <IconArrowBoxLeft /> Remove account
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </ConnectedRow>
  );
}

function CredentialMenu({
  displayName,
  credential,
  disabled,
  onSignInAgain,
  onAddAccount,
  signOutLabel,
  onSignOut,
  onUpdateKey,
  onRemoveKey,
}: {
  displayName: string;
  credential: ProviderCredential;
  disabled: boolean;
  onSignInAgain: (() => void) | undefined;
  onAddAccount: (() => void) | undefined;
  signOutLabel: string;
  onSignOut: () => void;
  onUpdateKey: (() => void) | undefined;
  onRemoveKey: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`${displayName} actions`} disabled={disabled}>
            <IconDotGrid1x3Horizontal />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        {credential === 'oauth' ? (
          <>
            {onSignInAgain && (
              <DropdownMenu.Item onClick={onSignInAgain}>
                <IconArrowRotateClockwise /> Sign in again
              </DropdownMenu.Item>
            )}
            {onAddAccount && (
              <DropdownMenu.Item onClick={onAddAccount}>
                <IconPlusMedium /> Add another account
              </DropdownMenu.Item>
            )}
            {(onSignInAgain || onAddAccount) && <DropdownMenu.Separator />}
            <DropdownMenu.Item variant="destructive" onClick={onSignOut}>
              <IconArrowBoxLeft /> {signOutLabel}
            </DropdownMenu.Item>
          </>
        ) : (
          <>
            {onUpdateKey && (
              <>
                <DropdownMenu.Item onClick={onUpdateKey}>
                  <IconKey2 /> Update key
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
              </>
            )}
            <DropdownMenu.Item variant="destructive" onClick={onRemoveKey}>
              <TrashIcon /> Remove key
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
